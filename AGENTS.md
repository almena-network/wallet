# Almena Wallet — notes for contributors and agents

The user's app for Almena Network, a decentralised messaging platform based on DIDComm Messaging v2.0
(https://identity.foundation/didcomm-messaging/spec/v2.0/). It talks to an Almena node (`../node`).

This project is independent: it has its own tooling and shares nothing with `../node` except the protocol.

## Layout

- `src/` — React + TypeScript front end (Vite). Package manager: pnpm.
- `src-tauri/` — Tauri v2 Rust side (`wallet_lib`).

## Rules

- Everything is written in English.
- User-facing text is translatable: English (`en`) is the source language, Spanish (`es`) the first translation. No hard-coded user-facing strings.
- Tasks live in `Taskfile.yml` (`task --list`). Before finishing a change: `task check`.
