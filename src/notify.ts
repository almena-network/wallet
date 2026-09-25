import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useTranslations } from "./i18n";

/**
 * How much a system notification says about a message that arrived while the
 * wallet was not in front — see `src-tauri/src/notify.rs`. Whatever it says,
 * the system keeps in its own history, outside the wallet's sealed storage.
 */
export const privacies = ["full", "name", "none"] as const;

export type Privacy = (typeof privacies)[number];

/** Who it is from, and not what it says: the middle of the three. */
const defaultPrivacy: Privacy = "name";

/** A preference about this device, kept where the theme and the auto-lock are. */
const storageKey = "almena.notifications";

function stored(): Privacy {
  try {
    const value = window.localStorage.getItem(storageKey);
    return (privacies as readonly string[]).includes(value ?? "") ? (value as Privacy) : defaultPrivacy;
  } catch {
    return defaultPrivacy;
  }
}

/**
 * The choice, and handing it to the Rust side with the words in the language
 * the interface is read in — that side has no catalogues. Sent again whenever
 * either changes.
 */
export function useNotificationPrivacy(): {
  privacy: Privacy;
  setPrivacy: (privacy: Privacy) => void;
} {
  const t = useTranslations();
  const [privacy, setPrivacyState] = useState<Privacy>(() => stored());

  useEffect(() => {
    void invoke("notifications_configure", {
      privacy,
      newMessage: t.notifications.newMessage,
      appName: t.app.name,
    }).catch(() => undefined);
  }, [privacy, t]);

  const setPrivacy = useCallback((next: Privacy) => {
    setPrivacyState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Losing the preference is acceptable; refusing the change is not.
    }
  }, []);

  return { privacy, setPrivacy };
}
