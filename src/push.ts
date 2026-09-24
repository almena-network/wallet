import { invoke } from "@tauri-apps/api/core";

/**
 * Push: the phone is told something is waiting while the wallet is not
 * running — see `src-tauri/src/messaging/push.rs`. The notification carries
 * nothing about any message; opening the wallet is what picks them up.
 */

/**
 * Registers this device with the mediation, asking for permission to notify
 * the first time. Resolves to whether the mediator will notify it (never on
 * desktop). Registering replaces the previous token, so it is done at every
 * unlock and whenever a mediator is chosen.
 */
export function registerPush(): Promise<boolean> {
  return invoke<boolean>("push_register").catch(() => false);
}

/**
 * Takes this device off the mediation's pushes before the identity leaves it.
 * Waits at most `limit` milliseconds: signing out must not hang on a mediator
 * that does not answer.
 */
export function unregisterPush(limit = 3000): Promise<void> {
  return Promise.race([
    invoke<void>("push_unregister").catch(() => undefined),
    new Promise<void>((done) => window.setTimeout(done, limit)),
  ]);
}
