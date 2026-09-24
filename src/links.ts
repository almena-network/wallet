import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

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
