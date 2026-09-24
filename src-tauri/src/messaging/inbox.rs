//! The wallet's DIDComm inbox: the DID the mediator knows it by, and the keys
//! behind it.
//!
//! **Derived from the seed, not drawn at random.** The keys sit at `m/1'/0'`
//! (Ed25519, authentication) and `m/1'/1'` (X25519, key agreement), so the same
//! words always make the same inbox: a wallet restored from its phrase asks the
//! mediator for the same mediation, and whatever was queued for it while it was
//! gone is still there to pick up.
//!
//! It is a `did:peer:2` whose only service points at the mediator, which is what
//! lets a sender wrap a message in a `forward` for it. The service is part of
//! the DID, so a different mediator makes a different inbox DID from the same
//! keys — which is also what keeps two mediators from seeing the same DID.

use almena_didcomm::did::peer::{peer2, Purpose};
use almena_didcomm::{Curve, InMemorySecrets, SecretKey};
use serde_json::json;

use super::MessagingError;
use crate::identity::keys::{self, INBOX};

/// Key ids `peer2` gives the keys, in the order they are passed to it.
const AUTHENTICATION: &str = "#key-1";
const KEY_AGREEMENT: &str = "#key-2";

/// The inbox DID for one mediator, and the secrets it speaks with.
pub struct Inbox {
    pub did: String,
    pub secrets: InMemorySecrets,
}

impl Inbox {
    /// The inbox that receives through `mediator` (the mediator's DID, which is
    /// also its routing DID).
    ///
    /// # Errors
    ///
    /// [`MessagingError::Keys`] if the derived bytes do not make a key, which
    /// for these two curves does not happen.
    pub fn new(seed: &[u8; 64], mediator: &str) -> Result<Self, MessagingError> {
        let signing = SecretKey::from_bytes(Curve::Ed25519, &*keys::derive(seed, &[INBOX, 0]))
            .map_err(|_| MessagingError::Keys)?;
        let agreement = SecretKey::from_bytes(Curve::X25519, &*keys::derive(seed, &[INBOX, 1]))
            .map_err(|_| MessagingError::Keys)?;

        let service = json!({
            "type": "DIDCommMessaging",
            "serviceEndpoint": {"uri": mediator, "accept": ["didcomm/v2"]},
        });
        let did = peer2(
            &[
                (Purpose::Verification, &signing.public_key()),
                (Purpose::Encryption, &agreement.public_key()),
            ],
            &[service],
        )
        .map_err(|_| MessagingError::Keys)?;

        let mut secrets = InMemorySecrets::new();
        secrets.insert(format!("{did}{AUTHENTICATION}"), signing);
        secrets.insert(format!("{did}{KEY_AGREEMENT}"), agreement);

        Ok(Self { did, secrets })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MEDIATOR: &str = "did:web:mediator.example.com";

    #[test]
    fn the_same_seed_makes_the_same_inbox() {
        let seed = [7u8; 64];
        let first = Inbox::new(&seed, MEDIATOR).expect("an inbox");
        let second = Inbox::new(&seed, MEDIATOR).expect("an inbox");
        assert_eq!(first.did, second.did);
        assert!(first.did.starts_with("did:peer:2"));
    }

    #[test]
    fn another_seed_or_another_mediator_makes_another_inbox() {
        let seed = [7u8; 64];
        let base = Inbox::new(&seed, MEDIATOR).expect("an inbox").did;
        assert_ne!(
            base,
            Inbox::new(&[8u8; 64], MEDIATOR).expect("an inbox").did
        );
        assert_ne!(
            base,
            Inbox::new(&seed, "did:web:other.example.com")
                .expect("an inbox")
                .did
        );
    }

    #[tokio::test]
    async fn the_inbox_resolves_to_its_keys_and_its_mediator() {
        use almena_didcomm::{DidResolver, LocalResolver};

        let inbox = Inbox::new(&[7u8; 64], MEDIATOR).expect("an inbox");
        let document = LocalResolver::new()
            .resolve(&inbox.did)
            .await
            .expect("a document");

        assert!(document
            .authentication_key(&format!("{}{AUTHENTICATION}", inbox.did))
            .is_ok());
        assert!(document
            .key_agreement_key(&format!("{}{KEY_AGREEMENT}", inbox.did))
            .is_ok());
        let endpoints = document
            .didcomm_services()
            .next()
            .expect("a service")
            .didcomm_endpoints()
            .expect("endpoints");
        assert_eq!(endpoints[0].uri, MEDIATOR);
    }
}
