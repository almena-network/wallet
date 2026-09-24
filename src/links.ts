import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

import type { Contact } from "./contacts";

/**
 * Links and codes from outside: an `almena://` link that opened the wallet, or
 * a code the scanner read. **Nothing from outside acts on the identity.** What
 * it is decides which screen it is carried to — accepting an invitation, or
 * connecting to a mediator — and nothing happens until somebody says so there.
 */
export type LinkKind = "contact" | "mediator" | "unknown";

/** What a link or a code is, read on the Rust side without acting on it. */
export function invitationKind(input: string): Promise<LinkKind> {
  return invoke<LinkKind>("invitation_kind", { input }).catch(() => "unknown");
}

/** What the confirmation sheet shows about a link or a code — see `link_details`. */
export type LinkDetails =
  | {
      kind: "contact";
      /** The fingerprint of the card the invitation names: it carries no name. */
      fingerprint: string;
      /** The relationship already opened with that card. */
      contact: Contact | null;
      /** This wallet's own invitation. */
      own: boolean;
    }
  | {
      kind: "mediator";
      mediator: string;
      current: string | null;
      /** Relationships routed through the current mediator. */
      contacts: number;
    }
  | { kind: "unknown" };

/** What a link or a code is, with what this wallet knows about it. Needs the wallet open. */
export function linkDetails(input: string): Promise<LinkDetails> {
  return invoke<LinkDetails>("link_details", { input });
}

/**
 * Calls `handle` with every `almena://` link the wallet is opened with: the
 * one that started it, and each one after — on a computer a link opened while
 * the wallet runs arrives through `single-instance`, on a phone through the
 * system.
 */
export function useDeepLinks(handle: (url: string) => void) {
  const latest = useRef(handle);
  latest.current = handle;

  useEffect(() => {
    let stop: (() => void) | undefined;
    let active = true;

    getCurrent()
      .then((urls) => {
        const first = urls?.[0];
        if (active && first) {
          latest.current(first);
        }
      })
      .catch(() => undefined);
    onOpenUrl((urls) => {
      const first = urls[0];
      if (first) {
        latest.current(first);
      }
    })
      .then((unlisten) => {
        if (active) {
          stop = unlisten;
        } else {
          unlisten();
        }
      })
      // No native backend behind the webview.
      .catch(() => undefined);

    return () => {
      active = false;
      stop?.();
    };
  }, []);
}
