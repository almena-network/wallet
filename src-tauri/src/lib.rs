//! Almena Wallet.
//!
//! One code base for Android, iOS, macOS, Linux and Windows. What differs per
//! platform is decided here with `cfg`, never by sniffing in the front end.
//!
//! [`backdrop`] is the colour behind the page and the appearance of the window
//! around it, both of which the window has to be told.
//!
//! [`scene`] is the second window an iPad offers, and why it is turned down.

mod backdrop;
#[cfg(target_os = "ios")]
mod scene;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![backdrop::backdrop_set])
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
