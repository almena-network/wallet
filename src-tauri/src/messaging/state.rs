//! What the wallet writes down about its messaging: for now, which mediator it
//! is connected to.
//!
//! **Sealed under a key the seed derives** — `m/2'`, see
//! [`crate::identity::keys::STATE`] — so it is readable exactly while the
//! wallet is open. Which mediator somebody uses is not a secret the way the seed
//! is, but it is the start of the list of relationships this file will hold,
//! and that list is nobody's business but the wallet's.
//!
//! It lives in the application's private directory, is written beside itself
//! and moved into place, and goes when the identity goes: signing out and
//! running out of PIN attempts both call [`clear`].

use std::fs;
use std::io::Write as _;
use std::path::PathBuf;

use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use base64::Engine as _;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};
use tauri::{Manager, Runtime};

use super::MessagingError;
use crate::identity::keys::{self, STATE};

const FILE: &str = "messaging.json";
const VERSION: u32 = 1;
/// Bound to the ciphertext, so a file of another format or version cannot be
/// opened as this one.
const AAD: &[u8] = b"almena-wallet/messaging/1";
const NONCE_BYTES: usize = 24;

/// The mediation this wallet has.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mediation {
    /// The mediator's DID.
    pub mediator: String,
    /// The inbox DID registered with it.
    pub inbox: String,
}

/// Everything in the file.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub mediation: Option<Mediation>,
}

/// The file on disk: its version and the sealed state.
#[derive(Serialize, Deserialize)]
struct Sealed {
    version: u32,
    nonce: String,
    ciphertext: String,
}

/// Reads the state, or an empty one when there is no file.
///
/// # Errors
///
/// [`MessagingError::Unreadable`] when the file does not open under this seed,
/// and [`MessagingError::Storage`] when it cannot be read at all.
pub fn read<R: Runtime>(
    app: &tauri::AppHandle<R>,
    seed: &[u8; 64],
) -> Result<State, MessagingError> {
    let bytes = match fs::read(file(app)?) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(State::default()),
        Err(_) => return Err(MessagingError::Storage),
    };
    open(&bytes, seed)
}

/// Writes the state, replacing what was there.
///
/// # Errors
///
/// [`MessagingError::Storage`] when it cannot be written, and
/// [`MessagingError::Entropy`] when there is no randomness for the nonce.
pub fn write<R: Runtime>(
    app: &tauri::AppHandle<R>,
    seed: &[u8; 64],
    state: &State,
) -> Result<(), MessagingError> {
    let bytes = seal(state, seed)?;
    let path = file(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| MessagingError::Storage)?;
    }

    let temporary = path.with_extension("json.writing");
    let mut handle = fs::File::create(&temporary).map_err(|_| MessagingError::Storage)?;
    handle
        .write_all(&bytes)
        .map_err(|_| MessagingError::Storage)?;
    handle.sync_all().map_err(|_| MessagingError::Storage)?;
    drop(handle);
    fs::rename(&temporary, &path).map_err(|_| MessagingError::Storage)
}

/// Removes the file. Called when the identity leaves the device.
pub fn clear<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Ok(path) = file(app) {
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("json.writing"));
    }
}

fn seal(state: &State, seed: &[u8; 64]) -> Result<Vec<u8>, MessagingError> {
    let plaintext = serde_json::to_vec(state).map_err(|_| MessagingError::Storage)?;
    let mut nonce = [0u8; NONCE_BYTES];
    getrandom::getrandom(&mut nonce).map_err(|_| MessagingError::Entropy)?;

    let key = keys::derive(seed, &[STATE]);
    let ciphertext = XChaCha20Poly1305::new(Key::from_slice(&*key))
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: &plaintext,
                aad: AAD,
            },
        )
        .map_err(|_| MessagingError::Storage)?;

    serde_json::to_vec(&Sealed {
        version: VERSION,
        nonce: B64.encode(nonce),
        ciphertext: B64.encode(ciphertext),
    })
    .map_err(|_| MessagingError::Storage)
}

fn open(bytes: &[u8], seed: &[u8; 64]) -> Result<State, MessagingError> {
    let sealed: Sealed = serde_json::from_slice(bytes).map_err(|_| MessagingError::Unreadable)?;
    if sealed.version != VERSION {
        return Err(MessagingError::Unreadable);
    }
    let nonce = B64
        .decode(&sealed.nonce)
        .ok()
        .filter(|nonce| nonce.len() == NONCE_BYTES)
        .ok_or(MessagingError::Unreadable)?;
    let ciphertext = B64
        .decode(&sealed.ciphertext)
        .map_err(|_| MessagingError::Unreadable)?;

    let key = keys::derive(seed, &[STATE]);
    let plaintext = XChaCha20Poly1305::new(Key::from_slice(&*key))
        .decrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: &ciphertext,
                aad: AAD,
            },
        )
        .map_err(|_| MessagingError::Unreadable)?;

    serde_json::from_slice(&plaintext).map_err(|_| MessagingError::Unreadable)
}

fn file<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, MessagingError> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join(FILE))
        .map_err(|_| MessagingError::Storage)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> State {
        State {
            mediation: Some(Mediation {
                mediator: "did:web:mediator.example.com".into(),
                inbox: "did:peer:2.Vz6Mk".into(),
            }),
        }
    }

    #[test]
    fn what_is_sealed_opens_under_the_same_seed() {
        let seed = [3u8; 64];
        let sealed = seal(&state(), &seed).expect("sealed");
        assert_eq!(open(&sealed, &seed).expect("opened"), state());
    }

    #[test]
    fn another_seed_opens_nothing() {
        let sealed = seal(&state(), &[3u8; 64]).expect("sealed");
        assert!(matches!(
            open(&sealed, &[4u8; 64]),
            Err(MessagingError::Unreadable)
        ));
    }

    #[test]
    fn the_file_says_nothing_about_what_it_holds() {
        let sealed = seal(&state(), &[3u8; 64]).expect("sealed");
        let text = String::from_utf8(sealed).expect("json");
        assert!(!text.contains("mediator.example.com"));
    }

    #[test]
    fn a_file_of_another_version_is_refused() {
        let sealed = seal(&state(), &[3u8; 64]).expect("sealed");
        let mut value: serde_json::Value = serde_json::from_slice(&sealed).expect("json");
        value["version"] = serde_json::json!(VERSION + 1);
        let bytes = serde_json::to_vec(&value).expect("json");
        assert!(matches!(
            open(&bytes, &[3u8; 64]),
            Err(MessagingError::Unreadable)
        ));
    }
}
