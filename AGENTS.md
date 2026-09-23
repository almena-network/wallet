# Almena Wallet — notes for contributors and agents

The user's app for Almena Network, a decentralised messaging platform based on DIDComm Messaging v2.0
(https://identity.foundation/didcomm-messaging/spec/v2.0/). It talks to an Almena mediator (`../mediator`).

This project is independent: it has its own tooling and shares nothing with `../mediator` except the protocol.

## Layout

- `src/` — React + TypeScript front end (Vite). Package manager: pnpm.
- `src-tauri/` — Tauri v2 Rust side (`wallet_lib`).
- `src-tauri/gen/android`, `src-tauri/gen/apple` — native projects from `tauri android|ios init`; regenerated, so settings that must survive live in `src-tauri/Info.ios.plist` and the Taskfile.
- `assets/branding/` — source artwork; `task icons` regenerates `src-tauri/icons` and `public/brand`. Android launcher icons under `src-tauri/icons/android` are hand-drawn.
- `src/styles/global.css` — the only place a colour is written; palettes keyed by `data-theme` and `data-accent` on the root.

The look follows the previous Almena ID wallet (github.com/almena-id/wallet, branch `develop`).

## Rules

- Everything is written in English.
- User-facing text is translatable: English (`en`) is the source language, Spanish (`es`) the first translation. No hard-coded user-facing strings.
- Tasks live in `Taskfile.yml` (`task --list`). Before finishing a change: `task check`.
