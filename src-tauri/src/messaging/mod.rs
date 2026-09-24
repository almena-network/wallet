//! Messaging: the wallet's mediation with a DIDComm mediator.
//!
//! A wallet has no address of its own, so it gets one from a mediator: it asks
//! for mediation (Coordinate Mediation 3.0), registers its inbox DID as a
//! recipient, and from then on anybody can reach that DID by wrapping a message
//! in a `forward` to the mediator, which queues it until the wallet picks it up
//! (Message Pickup 3.0). The protocols, and what the mediator requires of them,
//! are in the mediator's `docs/didcomm.md` §4–5.
//!
//! - [`inbox`]: the inbox DID and its keys, derived from the seed.
//! - [`mediator`]: finding a mediator and the authcrypted request/response.
//! - [`state`]: which mediator this wallet uses, sealed under the seed.
//!
//! Everything here needs the wallet open: the inbox keys and the state key both
//! come from the seed, which is only held while it is.

mod inbox;
mod mediator;
mod state;

use almena_didcomm::Message;
use serde::{Serialize, Serializer};
use serde_json::json;
use tauri::{Runtime, State};
use zeroize::Zeroizing;

use crate::identity::Held;
use inbox::Inbox;
use mediator::Mediator;
use state::Mediation;

const MEDIATE_REQUEST: &str = "https://didcomm.org/coordinate-mediation/3.0/mediate-request";
const RECIPIENT_UPDATE: &str = "https://didcomm.org/coordinate-mediation/3.0/recipient-update";
const STATUS_REQUEST: &str = "https://didcomm.org/messagepickup/3.0/status-request";

/// What can go wrong, as codes rather than prose.
#[derive(Debug, Clone, Copy)]
pub enum MessagingError {
    /// No identity is open, so there are no keys to speak with.
    Locked,
    /// What was pasted is not a mediator's invitation, address or DID.
    InvitationUnreadable,
    /// A mediator that would be reached over plain HTTP.
    Insecure,
    /// The mediator did not answer, or its answer could not be read.
    MediatorUnreachable,
    /// The mediator answered, and the answer was no.
    MediatorRefused,
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
            Self::Insecure => "messaging_insecure",
            Self::MediatorUnreachable => "messaging_mediator_unreachable",
            Self::MediatorRefused => "messaging_mediator_refused",
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
    input: String,
) -> Result<MediatorStatus, MessagingError> {
    let seed = seed(&held)?;
    let mediation = mediate(&seed, &input).await?;

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
) -> Result<MediatorStatus, MessagingError> {
    let seed = seed(&held)?;
    let mut state = state::read(&app, &seed)?;

    if let Some(mediation) = &state.mediation {
        if let Ok(mediator) = Mediator::resolve(&mediation.mediator).await {
            if let Ok(inbox) = Inbox::new(&seed, &mediator.did) {
                let _ = recipient_update(&mediator, &inbox, "remove").await;
            }
        }
    }

    state.mediation = None;
    state::write(&app, &seed, &state)?;
    Ok(MediatorStatus::from(None))
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
    let inbox = Inbox::new(seed, &mediator.did)?;

    let mut request = Message::new(MEDIATE_REQUEST, json!({}));
    request.pthid = target.invitation;
    let grant = mediator.request(&inbox, request).await?;
    let routes_here = grant.type_.ends_with("/mediate-grant")
        && grant.body["routing_did"]
            .as_array()
            .is_some_and(|dids| dids.iter().any(|did| did == mediator.did.as_str()));
    // The inbox DID's service names the mediator as its route; a grant that
    // routes through something else would leave it pointing at the wrong place.
    if !routes_here {
        return Err(MessagingError::MediatorRefused);
    }

    let update = recipient_update(&mediator, &inbox, "add").await?;
    if !matches!(update.as_str(), "success" | "no_change") {
        return Err(MessagingError::MediatorRefused);
    }

    Ok(Mediation {
        mediator: mediator.did,
        inbox: inbox.did,
    })
}

/// How many messages the mediator is holding for the inbox.
async fn waiting(seed: &[u8; 64], mediator: &str) -> Result<Waiting, MessagingError> {
    let mediator = Mediator::resolve(mediator).await?;
    let inbox = Inbox::new(seed, &mediator.did)?;

    let status = mediator
        .request(&inbox, Message::new(STATUS_REQUEST, json!({})))
        .await?;
    let message_count = status.body["message_count"]
        .as_u64()
        .filter(|_| status.type_.ends_with("/status"))
        .ok_or(MessagingError::MediatorUnreachable)?;

    Ok(Waiting { message_count })
}

/// Adds or removes the inbox as a recipient, and returns the mediator's result
/// for it (`success`, `no_change`, `client_error`, …).
async fn recipient_update(
    mediator: &Mediator,
    inbox: &Inbox,
    action: &str,
) -> Result<String, MessagingError> {
    let reply = mediator
        .request(
            inbox,
            Message::new(
                RECIPIENT_UPDATE,
                json!({"updates": [{"recipient_did": inbox.did, "action": action}]}),
            ),
        )
        .await?;

    let result = reply.body["updated"]
        .as_array()
        .and_then(|updated| {
            updated
                .iter()
                .find(|entry| entry["recipient_did"] == inbox.did.as_str())
        })
        .and_then(|entry| entry["result"].as_str())
        .ok_or(MessagingError::MediatorUnreachable)?;

    Ok(result.to_owned())
}

fn seed(held: &Held) -> Result<Zeroizing<[u8; 64]>, MessagingError> {
    held.seed().ok_or(MessagingError::Locked)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **Against a running mediator**, which is why it is ignored: start one
    /// with `ALMENA_PUBLIC_URL=http://localhost:8080 task dev:memory` in
    /// `../mediator` (or set `ALMENA_TEST_MEDIATOR`), then
    /// `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "needs a mediator running"]
    async fn a_wallet_gets_mediation_and_asks_what_is_waiting() {
        let address = std::env::var("ALMENA_TEST_MEDIATOR")
            .unwrap_or_else(|_| "http://localhost:8080".to_owned());
        let seed = [11u8; 64];

        let mediation = mediate(&seed, &address).await.expect("mediation");
        assert!(mediation.inbox.starts_with("did:peer:2"));

        // Asking again is the same mediation, and the inbox is already there.
        let again = mediate(&seed, &address).await.expect("mediation again");
        assert_eq!(again, mediation);

        let waiting = waiting(&seed, &mediation.mediator)
            .await
            .expect("pickup status");
        assert_eq!(waiting.message_count, 0);
    }
}
