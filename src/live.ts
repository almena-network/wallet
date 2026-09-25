import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Live delivery: a WebSocket to the mediator, kept open while the wallet is
 * in front so messages arrive as they are sent — see
 * `src-tauri/src/messaging/live.rs`. What arrives is announced with the
 * `messaging-changed` event (`onMessagesChanged` in `contacts.ts`).
 *
 * **Only while it is seen.** A socket held open in the background is battery
 * and data spent on nobody, and the system closes it anyway; the mediator's
 * transports assume exactly this (its `docs/didcomm.md` §5). Coming back to
 * the front starts a new one, since the old may have died unannounced.
 *
 * `keep` holds it open in the back as well — during a call, whose signals
 * arrive the same way and must not wait for the wallet to be looked at.
 */
export function useLive(open: boolean, keep = false) {
  const kept = useRef(keep);
  kept.current = keep;

  useEffect(() => {
    if (!open) {
      return;
    }
    const follow = () => {
      if (document.visibilityState === "visible") {
        void invoke("live_start").catch(() => undefined);
      } else if (!kept.current) {
        void invoke("live_stop").catch(() => undefined);
      }
    };
    follow();
    document.addEventListener("visibilitychange", follow);
    return () => {
      document.removeEventListener("visibilitychange", follow);
      void invoke("live_stop").catch(() => undefined);
    };
  }, [open]);

  // A call that ended while the wallet was in the back lets the socket go.
  useEffect(() => {
    if (open && !keep && document.visibilityState !== "visible") {
      void invoke("live_stop").catch(() => undefined);
    }
  }, [open, keep]);
}
