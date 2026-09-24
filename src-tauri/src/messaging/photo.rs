//! The picture the wallet shows for its own identity, on the profile screen.
//!
//! **Kept here and nowhere else.** It is sealed under the same key as the state
//! ([`super::state`]), in a file of its own so the state is not rewritten with
//! an image in it, and it goes when the identity goes. Nothing sends it to a
//! contact.
//!
//! The interface hands it over already made small — a square JPEG, as a
//! `data:` URL — and this only checks that it is one and not too big.

use std::fs;
use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use tauri::Runtime;

use super::state;
use super::MessagingError;

const FILE: &str = "photo.json";
const AAD: &[u8] = b"almena-wallet/photo/1";
const PREFIX: &str = "data:image/jpeg;base64,";
/// The largest picture kept, as the `data:` URL is written. A 512-pixel square
/// JPEG is far below it.
const MAX_BYTES: usize = 512 * 1024;

/// The picture, when there is one.
pub fn read<R: Runtime>(
    app: &tauri::AppHandle<R>,
    seed: &[u8; 64],
) -> Result<Option<String>, MessagingError> {
    state::load(&file(app)?, seed, AAD)
}

/// Keeps `photo`, or removes the one kept with `None`.
///
/// # Errors
///
/// [`MessagingError::PhotoInvalid`] for anything but a JPEG `data:` URL of at
/// most [`MAX_BYTES`].
pub fn write<R: Runtime>(
    app: &tauri::AppHandle<R>,
    seed: &[u8; 64],
    photo: Option<&str>,
) -> Result<(), MessagingError> {
    let path = file(app)?;
    let Some(photo) = photo else {
        return match fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err(MessagingError::Storage),
        };
    };
    if !valid(photo) {
        return Err(MessagingError::PhotoInvalid);
    }
    state::store(&path, seed, AAD, &photo)
}

/// Removes it. Called when the identity leaves the device.
pub fn clear<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Ok(path) = file(app) {
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("json.writing"));
    }
}

/// A JPEG `data:` URL of at most [`MAX_BYTES`]: base64 that decodes, to
/// bytes that start the way a JPEG does.
fn valid(photo: &str) -> bool {
    photo.len() <= MAX_BYTES
        && photo
            .strip_prefix(PREFIX)
            .and_then(|data| STANDARD.decode(data).ok())
            .is_some_and(|bytes| bytes.starts_with(&[0xFF, 0xD8, 0xFF]))
}

fn file<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, MessagingError> {
    state::directory(app).map(|dir| dir.join(FILE))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_small_jpeg_data_url_is_kept() {
        let jpeg = format!(
            "{PREFIX}{}",
            STANDARD.encode([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10])
        );
        assert!(valid(&jpeg));
        let png = format!(
            "data:image/png;base64,{}",
            STANDARD.encode([0x89, b'P', b'N', b'G'])
        );
        assert!(!valid(&png));
        assert!(!valid(&format!(
            "{PREFIX}{}",
            STANDARD.encode(b"not a jpeg")
        )));
        assert!(!valid(&format!("{PREFIX}!!!")));
        let huge = format!("{PREFIX}{}", STANDARD.encode(vec![0xFF; MAX_BYTES]));
        assert!(!valid(&huge));
    }
}
