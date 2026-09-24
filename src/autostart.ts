import { useCallback, useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

/**
 * Opening the wallet at login, on a computer. The login item is the system's —
 * a LaunchAgent on macOS, the registry on Windows, an autostart entry on Linux —
 * so whether it is on is asked of the system each time, never remembered here.
 * It starts the wallet minimised; see `window::MINIMIZED` on the Rust side.
 */
export function useAutostart(available: boolean): {
  /** `null` until the system has answered, or where there is no such thing. */
  enabled: boolean | null;
  setEnabled: (on: boolean) => Promise<void>;
} {
  const [enabled, setState] = useState<boolean | null>(null);

  useEffect(() => {
    if (!available) {
      return;
    }
    let active = true;
    isEnabled()
      .then((on) => active && setState(on))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [available]);

  const setEnabled = useCallback(async (on: boolean) => {
    await (on ? enable() : disable());
    // What the system now says, not what was asked for.
    setState(await isEnabled());
  }, []);

  return { enabled, setEnabled };
}
