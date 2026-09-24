# Almena Wallet — notes for contributors and agents

The user's app for Almena Network, a decentralised messaging platform based on DIDComm Messaging v2.0
(https://identity.foundation/didcomm-messaging/spec/v2.0/). It talks to an Almena mediator (`../mediator`).

This project is independent: it has its own tooling and shares nothing with `../mediator` except the protocol.

## Layout

- `src/` — React + TypeScript front end (Vite). Package manager: pnpm.
- `src-tauri/` — Tauri v2 Rust side (`wallet_lib`).
  - `identity/`: BIP-39 phrase → seed → SLIP-0010 `m/0'` → ed25519 `did:key`. The derivation is frozen and pinned by test vectors; changing it makes existing phrases open a different identity. The seed is held in memory while the wallet is open and never crosses to the front end.
  - `vault/`: the seed on the device between launches — a versioned record (Argon2id + XChaCha20-Poly1305, 10 PIN attempts) kept in the platform's secret store, or a private file on Android. Every PIN check goes through `attempt`.
  - `messaging/`: the mediation with a DIDComm mediator and the relationships through it, on `almena-didcomm` (git dependency on `../mediator`'s repository, pinned to a tag). Every DID is a `did:peer:2` derived from the seed whose service routes through the mediator (`peer.rs`): the inbox (`m/1'`, keys the mediation, never shared), the contact card (`m/4'`, named by the wallet's OOB invitation) and one pairwise per counterparty (`m/3'/…`, from a hash of the counterparty's DID). DIDs other than the inbox are registered with a possession proof. A relationship opens with a Trust Ping from the accepter's pairwise to the card, answered from a new pairwise with `from_prior` signed by the card (`contacts.rs`). The mediator and the relationships are sealed under `m/2'` (`state.rs`); no secret key is stored. Requests to the mediator are authcrypted with `return_route: "all"`, and each operation re-sends the idempotent `mediate-request` first. Plain HTTP only for loopback in debug builds. The protocol rules are the mediator's `docs/didcomm.md` §4–5.
- `src/screens/onboarding/` — welcome, phrase, confirmation quiz, restore; then `PinSetup`. `App.tsx` decides between onboarding, the lock (`PinScreen`) and the tabs from `vault_status`.
- `src/screens/MessagesTab.tsx` — the inbox and what its "+" leads to: `NewConversationScreen` (contacts, directory search — not published yet —, invitations), `InviteScreen` (QR from `src/qr.ts`, a dependency-free ISO 18004 encoder), `AcceptInvitationScreen`.
- `src-tauri/gen/android`, `src-tauri/gen/apple` — native projects from `tauri android|ios init`; regenerated, so settings that must survive live in `src-tauri/Info.ios.plist` and the Taskfile.
- `assets/branding/` — source artwork; `task icons` regenerates `src-tauri/icons` and `public/brand`. Android launcher icons under `src-tauri/icons/android` are hand-drawn.
- `src/styles/global.css` — the only place a colour is written; palettes keyed by `data-theme` and `data-accent` on the root.

The look follows the previous Almena ID wallet (github.com/almena-id/wallet, branch `develop`).

## Rules

- Everything is written in English.
- User-facing text is translatable: English (`en`) is the source language, Spanish (`es`) the first translation. No hard-coded user-facing strings.
- Tasks live in `Taskfile.yml` (`task --list`). Before finishing a change: `task check` (and `task check:mobile` when Rust changed).
- Against a local mediator: in `../mediator`, `ALMENA_PUBLIC_URL=http://localhost:8080 task dev:memory`; (add `ALMENA_RATE_LIMIT=0` for repeated test runs); then `cargo test -- --ignored` in `src-tauri`, or paste `http://localhost:8080` (or its `/oob?_oob=…` link) in Settings → Mediator. The iOS simulator reaches the host's `localhost`.
