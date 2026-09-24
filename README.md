# Almena Wallet

The wallet of Almena Network: the app people use to hold their identity and
exchange [DIDComm Messaging v2.0](https://identity.foundation/didcomm-messaging/spec/v2.0/)
messages through an Almena [mediator](https://github.com/almena-network/mediator).
One code base, built with Tauri v2, Vite and React, runs on Android, iOS,
macOS, Linux and Windows.

It is at an early stage: the shell, the look and the build for every platform
are in place, and so is onboarding — creating an identity from a new BIP-39
phrase or bringing one back from an existing phrase, then keeping it on the
device encrypted behind a PIN — and connecting to a mediator: the wallet asks
it for mediation, registers an inbox DID derived from the phrase, and can ask
how many messages are waiting. Reading and sending messages is next.

## Requirements

- Node 22+ with [pnpm](https://pnpm.io), stable Rust and [Task](https://taskfile.dev)
- Desktop: the [Tauri prerequisites](https://tauri.app/start/prerequisites/) of
  the host — WebView2 and the MSVC build tools on Windows,
  `libwebkit2gtk-4.1-dev` and friends on Linux, the Xcode command line tools on
  macOS
- Android: Android Studio (SDK and NDK), a JDK between 17 and 24 — Gradle
  rejects newer ones, including the JDK inside Android Studio
  (`brew install openjdk@17` is enough) — and the Rust targets
  `aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
- iOS (macOS only): Xcode, CocoaPods and the Rust targets
  `aarch64-apple-ios aarch64-apple-ios-sim`

The Android tasks find the SDK, NDK and a suitable JDK on their own; nothing
needs to be exported.

## Desktop

```bash
task dev        # the app with hot reload
task dev:web    # only the front end, in a browser (no Tauri APIs)
task build      # installers for this host
```

Installers are built on the platform they are for: `.app`/`.dmg` on macOS,
`.deb`/`.rpm`/`.AppImage` on Linux, `.msi`/`.exe` on Windows. They land in
`src-tauri/target/release/bundle`.

## Android

```bash
task deploy:android                # pick a device or emulator, build, install
task deploy:android DEVICE=Pixel   # skip the question
```

The native project is committed under `src-tauri/gen/android`; `task
init:android` regenerates it. A deploy lists what `adb` can reach — cabled,
over Wi-Fi and emulators — builds only for that target's ABI, and installs the
debug APK with the front end packaged inside.

## iOS

```bash
task deploy:ios                    # pick a device or simulator, build, install
task deploy:ios DEVICE="iPhone 17" # skip the question
```

The native project is committed under `src-tauri/gen/apple`; `task init:ios`
regenerates it. A simulator signs nothing. A physical iPhone needs an Apple
development team, written once into `.env.local` (not committed):

```bash
APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX
```

It is the Team ID under developer.apple.com > Membership; `TEAM=XXXXXXXXXX` on
the command line overrides it.

## Branding

Every icon comes from `assets/branding`:

```bash
task icons   # regenerate the desktop and iOS icons and sync the native projects
```

The Android launcher icons under `src-tauri/icons/android` are the exception:
they are layered and drawn by hand, and only ever copied forward.

## Development

`task --list` shows every task. Before sending a change, `task check`
(TypeScript, formatting, clippy, tests) must pass; see
[CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for the code
layout.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as
described in [SECURITY.md](SECURITY.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
