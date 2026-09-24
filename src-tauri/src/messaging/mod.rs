//! Messaging: the wallet's mediation with a DIDComm mediator, and the
//! relationships it has through it.
//!
//! A wallet has no address of its own, so it gets one from a mediator: it asks
//! for mediation (Coordinate Mediation 3.0), registers the DIDs it can be
//! reached at, and from then on anybody can reach one of them by wrapping a
//! message in a `forward` to the mediator, which queues it until the wallet
//! picks it up (Message Pickup 3.0). The protocols, and what the mediator
//! requires of them, are in the mediator's `docs/didcomm.md` §4–5.
//!
//! - [`peer`]: the DIDs the wallet speaks as — inbox, contact card, pairwise —
//!   all derived from the seed.
//! - [`mediator`]: finding a mediator and talking to it.
//! - [`contacts`]: invitations and the handshake that opens a relationship.
//! - [`state`]: the mediator and the relationships, sealed under the seed.
//!
//! Everything here needs the wallet open: every key and the state key come
//! from the seed, which is only held while it is.

mod contacts;
mod mediator;
mod peer;
mod state;

use almena_didcomm::{unpack, InMemorySecrets, Message};
use serde::{Serialize, Serializer};
use serde_json::json;
use tauri::async_runtime::Mutex;
use tauri::{Manager, Runtime, State};
use zeroize::Zeroizing;

use crate::identity::Held;
use mediator::Mediator;
use peer::Peer;
use state::{Mediation, Relationship};

const STATUS_REQUEST: &str = "https://didcomm.org/messagepickup/3.0/status-request";

/// How many `delivery-request`s one sync makes at most.
const SYNC_ROUNDS: usize = 10;

/// What can go wrong, as codes rather than prose.
#[derive(Debug, Clone, Copy)]
pub enum MessagingError {
    /// No identity is open, so there are no keys to speak with.
    Locked,
    /// What was pasted is not an invitation, address or DID this wallet reads.
    InvitationUnreadable,
    /// This wallet's own invitation, pasted back into it.
    InvitationOwn,
    /// A mediator that would be reached over plain HTTP.
    Insecure,
    /// The mediator did not answer, or its answer could not be read.
    MediatorUnreachable,
    /// The mediator answered, and the answer was no.
    MediatorRefused,
    /// The counterparty could not be written to: its DID did not resolve,
    /// named no mailbox, or the mailbox did not take the message.
    CounterpartyUnreachable,
    /// Asked for something that needs a mediation this wallet does not have.
    NotConnected,
    /// The keys could not be made or used.
    Keys,
    /// The state on disk is not one this wallet can open.
    Unreadable,
    /// The state could not be read from or written to disk.
    Storage,
    /// The system would not supply randomness.
    Entropy,
}

impl MessagingError {
    const fn code(self) -> &'static str {
        match self {
            Self::Locked => "messaging_locked",
            Self::InvitationUnreadable => "messaging_invitation_unreadable",
            Self::InvitationOwn => "messaging_invitation_own",
            Self::Insecure => "messaging_insecure",
            Self::MediatorUnreachable => "messaging_mediator_unreachable",
            Self::MediatorRefused => "messaging_mediator_refused",
            Self::CounterpartyUnreachable => "messaging_counterparty_unreachable",
            Self::NotConnected => "messaging_not_connected",
            Self::Keys => "messaging_keys",
            Self::Unreadable => "messaging_unreadable",
            Self::Storage => "messaging_storage",
            Self::Entropy => "messaging_entropy",
        }
    }
}

impl Serialize for MessagingError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.code())
    }
}

/// Serialises everything that reads the state and writes it back, so a sync
/// and an accepted invitation cannot both start from the same copy. Held
/// across the network calls in between, which is why it is an async lock.
#[derive(Default)]
pub struct Gate(Mutex<()>);

/// The mediation as the interface shows it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediatorStatus {
    /// The mediator's DID, when there is a mediation.
    pub mediator: Option<String>,
    /// The inbox DID registered with it.
    pub inbox: Option<String>,
}

impl From<Option<&Mediation>> for MediatorStatus {
    fn from(mediation: Option<&Mediation>) -> Self {
        Self {
            mediator: mediation.map(|m| m.mediator.clone()),
            inbox: mediation.map(|m| m.inbox.clone()),
        }
    }
}

/// What is waiting at the mediator.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Waiting {
    pub message_count: u64,
}

/// A relationship as the interface shows it. The DIDs stay on this side.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    /// A stable identifier for the interface to key rows by.
    pub id: String,
    /// A short fingerprint until contacts have names.
    pub name: String,
    /// Waiting for the counterparty's first answer.
    pub pending: bool,
    pub since: u64,
}

impl From<&Relationship> for Contact {
    fn from(relationship: &Relationship) -> Self {
        Self {
            id: contacts::name(&relationship.ours),
            name: contacts::name(&relationship.origin),
            pending: relationship.pending,
            since: relationship.since,
        }
    }
}

/// The wallet's own invitation.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shown {
    pub url: String,
}

/// What a sync came to.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Synced {
    /// Relationships opened or confirmed by what arrived.
    pub changed: usize,
    pub contacts: Vec<Contact>,
}

/// The mediation this wallet has, if any. Reads the device only.
#[tauri::command]
pub fn mediator_status<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
) -> Result<MediatorStatus, MessagingError> {
    let seed = seed(&held)?;
    let state = state::read(&app, &seed)?;
    Ok(state.mediation.as_ref().into())
}

/// Connects to the mediator somebody pasted: asks for mediation, registers the
/// inbox with it, and writes down that it did.
///
/// Asking again is harmless: the mediator grants the same mediation to the same
/// inbox and answers `no_change` to a DID it already has.
#[tauri::command]
pub async fn mediator_connect<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
    gate: State<'_, Gate>,
    input: String,
) -> Result<MediatorStatus, MessagingError> {
    let seed = seed(&held)?;
    let mediation = mediate(&seed, &input).await?;

    let _guard = gate.0.lock().await;
    let mut state = state::read(&app, &seed)?;
    state.mediation = Some(mediation);
    state::write(&app, &seed, &state)?;

    Ok(state.mediation.as_ref().into())
}

/// Asks the mediator how many messages it is holding for this wallet.
#[tauri::command]
pub async fn mediator_check<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
) -> Result<Waiting, MessagingError> {
    let seed = seed(&held)?;
    let mediation = state::read(&app, &seed)?
        .mediation
        .ok_or(MessagingError::NotConnected)?;
    waiting(&seed, &mediation.mediator).await
}

/// Leaves the mediator: takes the inbox off its recipients if it answers, and
/// forgets the mediation either way — a mediator that is gone must not keep a
/// wallet from choosing another.
#[tauri::command]
pub async fn mediator_disconnect<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
    gate: State<'_, Gate>,
) -> Result<MediatorStatus, MessagingError> {
    let seed = seed(&held)?;
    let _guard = gate.0.lock().await;
    let mut state = state::read(&app, &seed)?;

    if let Some(mediation) = &state.mediation {
        if let Ok(mediator) = Mediator::resolve(&mediation.mediator).await {
            if let Ok(inbox) = Peer::inbox(&seed, &mediator.did) {
                let _ = mediator.recipient(&inbox, &inbox, "remove").await;
            }
        }
    }

    state.mediation = None;
    state::write(&app, &seed, &state)?;
    Ok(MediatorStatus::from(None))
}

/// The relationships this wallet has, newest first. Reads the device only.
#[tauri::command]
pub fn contacts_list<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
) -> Result<Vec<Contact>, MessagingError> {
    let seed = seed(&held)?;
    Ok(listed(&state::read(&app, &seed)?.relationships))
}

/// The wallet's own invitation, with its contact card registered at the
/// mediator so that whoever accepts it can reach it.
#[tauri::command]
pub async fn invitation_show<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
) -> Result<Shown, MessagingError> {
    let seed = seed(&held)?;
    let mediation = state::read(&app, &seed)?
        .mediation
        .ok_or(MessagingError::NotConnected)?;
    Ok(Shown {
        url: invitation(&seed, &mediation.mediator).await?,
    })
}

/// Accepts somebody's invitation, and writes down the relationship it opens.
#[tauri::command]
pub async fn contact_accept<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
    gate: State<'_, Gate>,
    input: String,
) -> Result<Contact, MessagingError> {
    let seed = seed(&held)?;
    let invitation = contacts::read(&input)?;

    let _guard = gate.0.lock().await;
    let mut state = state::read(&app, &seed)?;
    let relationship = accept(&seed, &mut state, &invitation).await?;
    state::write(&app, &seed, &state)?;

    Ok(Contact::from(&relationship))
}

/// Picks up what is waiting, handles what opens or confirms a relationship, and
/// returns the relationships as they are after it.
#[tauri::command]
pub async fn messages_sync<R: Runtime>(
    app: tauri::AppHandle<R>,
    held: State<'_, Held>,
    gate: State<'_, Gate>,
) -> Result<Synced, MessagingError> {
    let seed = seed(&held)?;

    let _guard = gate.0.lock().await;
    let mut state = state::read(&app, &seed)?;
    let changed = sync(&seed, &mut state).await?;
    if changed > 0 {
        state::write(&app, &seed, &state)?;
    }

    Ok(Synced {
        changed,
        contacts: listed(&state.relationships),
    })
}

/// Registers the lock the commands that change the state hold.
pub fn manage<R: Runtime>(app: &tauri::AppHandle<R>) {
    app.manage(Gate::default());
}

/// Forgets everything messaging wrote down. Called when the identity leaves the
/// device, by signing out or by running out of PIN attempts.
pub fn clear<R: Runtime>(app: &tauri::AppHandle<R>) {
    state::clear(app);
}

/// Asks for mediation from the mediator `input` names and registers the inbox
/// with it: the protocol half of [`mediator_connect`], without the state.
async fn mediate(seed: &[u8; 64], input: &str) -> Result<Mediation, MessagingError> {
    let target = mediator::target(input)?;
    let mediator = Mediator::resolve(&target.did).await?;
    let inbox = Peer::inbox(seed, &mediator.did)?;

    mediator.ensure(&inbox, target.invitation).await?;

    Ok(Mediation {
        mediator: mediator.did,
        inbox: inbox.did,
    })
}

/// How many messages the mediator is holding for the inbox.
async fn waiting(seed: &[u8; 64], mediator: &str) -> Result<Waiting, MessagingError> {
    let mediator = Mediator::resolve(mediator).await?;
    let inbox = Peer::inbox(seed, &mediator.did)?;

    let status = mediator
        .request(&inbox, Message::new(STATUS_REQUEST, json!({})))
        .await?;
    let message_count = status.body["message_count"]
        .as_u64()
        .filter(|_| status.type_.ends_with("/status"))
        .ok_or(MessagingError::MediatorUnreachable)?;

    Ok(Waiting { message_count })
}

/// Registers the contact card and returns the invitation that names it.
async fn invitation(seed: &[u8; 64], mediator: &str) -> Result<String, MessagingError> {
    let mediator = Mediator::resolve(mediator).await?;
    let inbox = Peer::inbox(seed, &mediator.did)?;
    let card = Peer::card(seed, &mediator.did)?;
    mediator.ensure(&inbox, None).await?;
    mediator.register(&inbox, &card).await?;
    Ok(contacts::link(&card.did))
}

/// Accepts an invitation into `state`: the protocol half of
/// [`contact_accept`].
async fn accept(
    seed: &[u8; 64],
    state: &mut state::State,
    invitation: &contacts::Invitation,
) -> Result<Relationship, MessagingError> {
    let mediation = state
        .mediation
        .as_ref()
        .ok_or(MessagingError::NotConnected)?;
    let mediator = Mediator::resolve(&mediation.mediator).await?;
    let inbox = Peer::inbox(seed, &mediator.did)?;
    let card = Peer::card(seed, &mediator.did)?;
    mediator.ensure(&inbox, None).await?;

    let relationship = contacts::accept(
        seed,
        &mediator,
        &inbox,
        &card,
        invitation,
        &state.relationships,
    )
    .await?;
    upsert(&mut state.relationships, relationship.clone());
    Ok(relationship)
}

/// Picks up and handles what is waiting: the protocol half of
/// [`messages_sync`]. Returns how many relationships it opened or confirmed.
///
/// A message this version does not handle is left queued, so a later version
/// can; one that cannot be opened at all is acknowledged, because it never will
/// be.
async fn sync(seed: &[u8; 64], state: &mut state::State) -> Result<usize, MessagingError> {
    let mediation = state
        .mediation
        .clone()
        .ok_or(MessagingError::NotConnected)?;
    let mediator = Mediator::resolve(&mediation.mediator).await?;
    let inbox = Peer::inbox(seed, &mediator.did)?;
    let card = Peer::card(seed, &mediator.did)?;
    mediator.ensure(&inbox, None).await?;

    let mut changed = 0;
    for _ in 0..SYNC_ROUNDS {
        let deliveries = mediator.deliveries(&inbox).await?;
        if deliveries.is_empty() {
            break;
        }

        // Every DID a message can be for: the card and each pairwise, derived
        // again rather than kept.
        let mut secrets = InMemorySecrets::new();
        inbox.add_to(&mut secrets);
        card.add_to(&mut secrets);
        for relationship in &state.relationships {
            Peer::pairwise(seed, &mediator.did, &relationship.origin)?.add_to(&mut secrets);
        }

        let mut received = Vec::new();
        for (id, envelope) in deliveries {
            let Ok((message, metadata)) = unpack(&envelope, mediator.resolver(), &secrets).await
            else {
                received.push(id);
                continue;
            };
            if !metadata.authenticated {
                received.push(id);
                continue;
            }
            let to = message.to.clone().unwrap_or_default();

            match message.type_.as_str() {
                contacts::PING if to.contains(&card.did) => {
                    // A sender that cannot be answered now is left queued and
                    // tried again on the next sync, without holding up the rest.
                    if let Ok(relationship) = contacts::welcome(
                        seed,
                        &mediator,
                        &inbox,
                        &card,
                        &message,
                        &state.relationships,
                    )
                    .await
                    {
                        upsert(&mut state.relationships, relationship);
                        changed += 1;
                        received.push(id);
                    }
                }
                contacts::PING_RESPONSE => {
                    if let Some(relationship) = state
                        .relationships
                        .iter_mut()
                        .find(|r| to.contains(&r.ours))
                    {
                        // The rotation the invitation's card signed: the
                        // conversation moves to the pairwise that sent this.
                        if let Some(rotation) = &metadata.from_prior {
                            if rotation.iss == relationship.theirs
                                && message.from.as_deref() == Some(rotation.sub.as_str())
                            {
                                relationship.theirs = rotation.sub.clone();
                            }
                        }
                        if relationship.pending
                            && message.from.as_deref() == Some(relationship.theirs.as_str())
                        {
                            relationship.pending = false;
                            changed += 1;
                        }
                    }
                    received.push(id);
                }
                _ => {}
            }
        }

        // Nothing taken this round means what is left is for a later version;
        // asking again would only bring the same messages back.
        if received.is_empty() {
            break;
        }
        mediator.acknowledge(&inbox, &received).await?;
    }

    Ok(changed)
}

/// Replaces the relationship opened with the same DID, or adds it.
fn upsert(relationships: &mut Vec<Relationship>, relationship: Relationship) {
    match relationships
        .iter_mut()
        .find(|r| r.origin == relationship.origin)
    {
        Some(existing) => *existing = relationship,
        None => relationships.push(relationship),
    }
}

fn listed(relationships: &[Relationship]) -> Vec<Contact> {
    let mut contacts: Vec<Contact> = relationships.iter().map(Contact::from).collect();
    contacts.sort_by_key(|contact| std::cmp::Reverse(contact.since));
    contacts
}

fn seed(held: &Held) -> Result<Zeroizing<[u8; 64]>, MessagingError> {
    held.seed().ok_or(MessagingError::Locked)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Where the ignored tests find a mediator: start one with
    /// `ALMENA_PUBLIC_URL=http://localhost:8080 task dev:memory` in
    /// `../mediator` (or set `ALMENA_TEST_MEDIATOR`), then
    /// `cargo test -- --ignored`.
    fn address() -> String {
        std::env::var("ALMENA_TEST_MEDIATOR").unwrap_or_else(|_| "http://localhost:8080".to_owned())
    }

    #[tokio::test]
    #[ignore = "needs a mediator running"]
    async fn a_wallet_gets_mediation_and_asks_what_is_waiting() {
        let seed = [11u8; 64];

        let mediation = mediate(&seed, &address()).await.expect("mediation");
        assert!(mediation.inbox.starts_with("did:peer:2"));

        // Asking again is the same mediation, and the inbox is already there.
        let again = mediate(&seed, &address()).await.expect("mediation again");
        assert_eq!(again, mediation);

        let waiting = waiting(&seed, &mediation.mediator)
            .await
            .expect("pickup status");
        assert_eq!(waiting.message_count, 0);
    }

    /// Two wallets on the same mediator: Bob accepts Alice's invitation, and
    /// after each has synced they know each other by pairwise DIDs only.
    #[tokio::test]
    #[ignore = "needs a mediator running"]
    async fn two_wallets_open_a_relationship_through_an_invitation() {
        let (alice_seed, bob_seed) = ([21u8; 64], [22u8; 64]);
        let mut alice = state::State {
            mediation: Some(mediate(&alice_seed, &address()).await.expect("alice")),
            relationships: Vec::new(),
        };
        let mut bob = state::State {
            mediation: Some(mediate(&bob_seed, &address()).await.expect("bob")),
            relationships: Vec::new(),
        };
        let mediator = alice.mediation.clone().expect("mediation").mediator;

        let link = invitation(&alice_seed, &mediator)
            .await
            .expect("invitation");
        let accepted = accept(&bob_seed, &mut bob, &contacts::read(&link).expect("read"))
            .await
            .expect("accepted");
        assert!(accepted.pending);

        assert_eq!(sync(&alice_seed, &mut alice).await.expect("alice syncs"), 1);
        assert_eq!(sync(&bob_seed, &mut bob).await.expect("bob syncs"), 1);

        let (a, b) = (&alice.relationships[0], &bob.relationships[0]);
        assert!(!a.pending && !b.pending);
        assert_eq!(a.theirs, b.ours);
        assert_eq!(b.theirs, a.ours);
        // Neither ended up speaking to the other's card or inbox.
        let card = Peer::card(&alice_seed, &mediator).expect("card").did;
        assert_ne!(b.theirs, card);

        // Nothing is left behind, and a second sync changes nothing.
        assert_eq!(sync(&alice_seed, &mut alice).await.expect("again"), 0);
        assert_eq!(
            waiting(&bob_seed, &mediator)
                .await
                .expect("status")
                .message_count,
            0
        );
    }
}
