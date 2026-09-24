//! Almena Wallet.
//!
//! One code base for Android, iOS, macOS, Linux and Windows. What differs per
//! platform is decided here with `cfg`, never by sniffing in the front end.
//!
//! [`backdrop`] is the colour behind the page and the appearance of the window
//! around it, both of which the window has to be told.
//!
//! [`scene`] is the second window an iPad offers, and why it is turned down.
//!
//! [`identity`] makes an identity from a phrase and holds its seed while the
//! wallet is open; [`vault`] keeps that seed on the device between launches,
//! encrypted behind a PIN. The seed never crosses to the front end.
//!
//! [`messaging`] is the wallet's mediation with a DIDComm mediator and the
//! relationships it has through it.

mod backdrop;
mod identity;
mod messaging;
#[cfg(target_os = "ios")]
mod scene;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Writing to the clipboard: the webview's own `navigator.clipboard`
        // is refused on iOS. Only `write-text` is granted — see capabilities.
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            identity::manage(app.handle());
            vault::manage(app.handle());
            messaging::manage(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backdrop::backdrop_set,
            identity::identity_draft,
            identity::identity_create,
            identity::identity_restore,
            identity::identity_discard,
            identity::identity_forget,
            vault::vault_status,
            vault::vault_create,
            vault::vault_open,
            vault::vault_destroy,
            messaging::mediator_status,
            messaging::mediator_connect,
            messaging::mediator_check,
            messaging::mediator_disconnect,
            messaging::contacts_list,
            messaging::invitation_show,
            messaging::contact_accept,
            messaging::messages_sync,
        ])
        .build(tauri::generate_context!())
        .expect("error while building the Almena Wallet")
        .run(|_app, _event| {
            // An iPad opening a second window of a wallet that has one — see
            // [`scene`].
            #[cfg(target_os = "ios")]
            if let tauri::RunEvent::SceneRequested { scene, .. } = &_event {
                scene::refuse(scene);
            }
        });
}
