import { invoke } from "@tauri-apps/api/core";

/**
 * The relationships this wallet has. Everything behind these calls happens on
 * the Rust side — see `src-tauri/src/messaging/contacts.rs` — and no DID crosses
 * to this side: a contact is shown by a short fingerprint until it has a name.
 */
export type Contact = {
  /** A stable key for the row. */
  id: string;
  /** A short fingerprint of the DID the relationship was opened with. */
  name: string;
  /** Waiting for the other side's first answer. */
  pending: boolean;
  /** When it was opened, in seconds since the epoch. */
  since: number;
};

export type Synced = {
  /** Relationships opened or confirmed by what arrived. */
  changed: number;
  contacts: Contact[];
};

export function listContacts(): Promise<Contact[]> {
  return invoke<Contact[]>("contacts_list");
}

/** Picks up what the mediator is holding and handles what opens a relationship. */
export function syncMessages(): Promise<Synced> {
  return invoke<Synced>("messages_sync");
}

/** This wallet's own invitation link, with its contact card registered. */
export function showInvitation(): Promise<string> {
  return invoke<{ url: string }>("invitation_show").then((shown) => shown.url);
}

/** Accepts somebody's invitation link. */
export function acceptInvitation(input: string): Promise<Contact> {
  return invoke<Contact>("contact_accept", { input });
}
