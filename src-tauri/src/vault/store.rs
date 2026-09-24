//! Where the record is kept, which is not the same place on every system.
//!
//! **The platform's own secret store first.** On iOS and macOS that is the
//! Keychain, on Windows the Credential Manager, on Linux the Secret Service. It
//! is not chosen for secrecy alone — the record is already encrypted — but for
//! what it survives: a Keychain item outlives the app being deleted, so a wallet
//! reinstalled on the same phone finds its identity where it left it, which a
//! file inside the application's own container would not.
//!
//! **The store is named, never guessed.** `keyring-core` is given exactly one
//! store per platform and answers `NoDefaultStore` where it was given none. The
//! umbrella `keyring` crate would instead pick one for you, and the one it picks
//! on Android is an in-memory stub: it would look like it was working and lose
//! the identity on every launch. Nothing here can fail that way.
//!
//! **Android has no store this side can reach**, so nothing is registered there
//! and the record goes to the application's private storage, which no other
//! application can read and which survives an update. Reaching the Android
//! Keystore needs a Kotlin bridge the wallet does not have yet; until it does,
//! this is said out loud rather than implied.
//!
//! **macOS uses the file keychain**, which every build can reach — signed,
//! ad-hoc signed or not signed at all — so an identity is never held hostage by
//! how the copy of the wallet in front of somebody was built. The data
//! protection keychain, which only signed builds reach, is for the device key
//! that opening with a finger will need, and that is not built yet.
//!
//! Two things this is bound to on Apple platforms, and neither is obvious:
//!
//! - **A Keychain item belongs to the team and the bundle identifier together.**
//!   Changing `APPLE_DEVELOPMENT_TEAM` or the identifier in `tauri.conf.json`
//!   gives the next build a different access group, and the record already on
//!   the phone becomes unreachable — not corrupted, not deleted, simply somebody
//!   else's. The way back is the phrase.
//! - **On iOS the record is pinned to the device it was written on.**
//!   `when-unlocked-this-device-only` keeps it out of every backup and off every
//!   other phone.
//!
//! Reading looks in both places, because a wallet whose store stopped answering
//! — a Linux session with no Secret Service running — must not conclude that
//! there is no identity. Writing goes to one place and clears the other, so
//! there is never a second, older copy to find.

use std::fs;
use std::io::Write as _;
use std::path::PathBuf;

use tauri::{Manager, Runtime};

use super::VaultError;

/// Where a record was found, or where one was put.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Home {
    /// The platform's secret store.
    Store,
    /// A file in the application's private directory.
    File,
}

impl Home {
    pub const fn name(self) -> &'static str {
        match self {
            Self::Store => "store",
            Self::File => "file",
        }
    }
}

/// The file the record falls back to, inside the application's own directory.
const FILE: &str = "vault.json";

/// The service every item is filed under. The bundle identifier, so the items
/// are recognisably this wallet's wherever somebody looks at them.
const SERVICE: &str = "network.almena.wallet";
const RECORD: &str = "vault";

/// Registers the one store this platform has, if it has one.
///
/// Called once at startup. A platform with nothing to register is left with
/// nothing, and every call below answers accordingly rather than pretending.
pub fn init() {
    #[cfg(target_os = "ios")]
    if let Ok(store) = apple_native_keyring_store::protected::Store::new() {
        keyring_core::set_default_store(store);
    }

    #[cfg(target_os = "macos")]
    if let Ok(store) = apple_native_keyring_store::keychain::Store::new() {
        keyring_core::set_default_store(store);
    }

    #[cfg(windows)]
    if let Ok(store) = windows_native_keyring_store::store::Store::new() {
        keyring_core::set_default_store(store);
    }

    #[cfg(all(
        unix,
        not(any(target_os = "macos", target_os = "ios", target_os = "android"))
    ))]
    if let Ok(store) = zbus_secret_service_keyring_store::store::Store::new() {
        keyring_core::set_default_store(store);
    }
}

/// Reads the record, from wherever it is.
///
/// # Errors
///
/// [`VaultError::Storage`] when a place that should have answered did not — as
/// distinct from answering that it holds nothing.
pub fn read<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Option<(Vec<u8>, Home)>, VaultError> {
    // **"It holds nothing" and "it would not say" are different answers.** A
    // locked Linux keyring, or a macOS keychain prompt somebody dismissed, must
    // not come back as an empty device: the wallet would offer to create a
    // second identity over the one already there, and the first wrong PIN
    // afterwards would take the copy it had just written.
    match stored_record() {
        Ok(Some(bytes)) => return Ok(Some((bytes, Home::Store))),
        Ok(None) => {}
        Err(failure) => return Err(failure),
    }

    let path = file(app)?;
    match fs::read(&path) {
        Ok(bytes) => Ok(Some((bytes, Home::File))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err(VaultError::Storage),
    }
}

/// Writes the record, and clears whatever copy the other place was holding.
///
/// # Errors
///
/// [`VaultError::Storage`] when neither place would take it.
pub fn write<R: Runtime>(app: &tauri::AppHandle<R>, bytes: &[u8]) -> Result<Home, VaultError> {
    if record_entry().is_ok_and(|entry| entry.set_secret(bytes).is_ok()) {
        // Not an error if it was not there: what matters is that it is not there
        // now.
        let _ = fs::remove_file(file(app)?);
        return Ok(Home::Store);
    }

    // **iOS does not fall back.** A file in the container would be the one copy
    // of the identity without the two guarantees the Keychain item carries: it
    // would ride along in an encrypted backup, and it would not be pinned to
    // this phone. Saying that the write failed is better than quietly keeping
    // the seed somewhere weaker than the wallet claims to keep it.
    if cfg!(target_os = "ios") {
        return Err(VaultError::Storage);
    }

    let path = file(app)?;
    if let Some(parent) = path.parent() {
        // Nothing else creates this: Tauri only resolves the path.
        fs::create_dir_all(parent).map_err(|_| VaultError::Storage)?;
    }

    // Written beside itself and moved into place — in the same directory, so the
    // move is a rename and not a copy across filesystems. A wallet interrupted
    // halfway through a write is left with the record it had rather than half
    // of a new one.
    let temporary = path.with_extension("json.writing");
    let mut handle = fs::File::create(&temporary).map_err(|_| VaultError::Storage)?;
    handle.write_all(bytes).map_err(|_| VaultError::Storage)?;
    handle.sync_all().map_err(|_| VaultError::Storage)?;
    drop(handle);
    fs::rename(&temporary, &path).map_err(|_| VaultError::Storage)?;

    // The store would not take it, so whatever it is still holding is older than
    // what was just written — and reading prefers the store. Left there, it
    // would come back the moment the store started answering again and quietly
    // undo this write.
    if let Ok(entry) = record_entry() {
        let _ = entry.delete_credential();
    }

    Ok(Home::File)
}

/// Removes the record, wherever it is.
pub fn clear<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Ok(entry) = record_entry() {
        let _ = entry.delete_credential();
    }
    if let Ok(path) = file(app) {
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("json.writing"));
    }
}

/// What the store holds, and the difference between empty and unavailable.
fn stored_record() -> Result<Option<Vec<u8>>, VaultError> {
    let entry = match record_entry() {
        Ok(entry) => entry,
        // No store was registered for this platform at all, which is Android and
        // is not a failure: the file is where the record lives there.
        Err(keyring_core::Error::NoDefaultStore) => return Ok(None),
        Err(_) => return Err(VaultError::Storage),
    };

    match entry.get_secret() {
        Ok(bytes) => Ok(Some(bytes)),
        Err(keyring_core::Error::NoEntry) => Ok(None),
        Err(_) => Err(VaultError::Storage),
    }
}

/// The record's entry, kept for this device alone.
fn record_entry() -> keyring_core::Result<keyring_core::Entry> {
    #[cfg(target_os = "ios")]
    {
        keyring_core::Entry::new_with_modifiers(
            SERVICE,
            RECORD,
            &std::collections::HashMap::from([("access-policy", "when-unlocked-this-device-only")]),
        )
    }

    #[cfg(not(target_os = "ios"))]
    keyring_core::Entry::new(SERVICE, RECORD)
}

fn file<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, VaultError> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join(FILE))
        .map_err(|_| VaultError::Storage)
}
