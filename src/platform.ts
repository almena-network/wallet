import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * What the Rust side reports about the host. It is the authority on which
 * plugins this build registered, because it answers from the same
 * compile-time switches that registered them.
 */
export type PlatformInfo = {
  kind: "desktop" | "mobile" | "unknown";
  /** Whether this build can read a code with the camera. */
  barcodeScanner: boolean;
};

/**
 * Used until the Rust side answers, and when there is none — `task dev:web`
 * runs the front end in a plain browser, where nothing native exists.
 */
const unknownPlatform: PlatformInfo = { kind: "unknown", barcodeScanner: false };

export function usePlatform(): PlatformInfo {
  const [platform, setPlatform] = useState<PlatformInfo>(unknownPlatform);

  useEffect(() => {
    let active = true;
    invoke<PlatformInfo>("platform_info")
      .then((info) => active && setPlatform(info))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return platform;
}
