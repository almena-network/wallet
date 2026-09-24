import { useState } from "react";

import { MediatorCard } from "../components/MediatorCard";
import { fill, useTranslations } from "../i18n";
import { useMediation } from "../mediator";
import type { VaultStatus } from "../vault";
import { MediatorConnectScreen } from "./MediatorConnectScreen";

type SettingsScreenProps = {
  /** What the device is keeping, which the security card describes. */
  vault: VaultStatus;
  /** Opens the screen that asks whether somebody really means it. */
  onSignOut: () => void;
};

export function SettingsScreen({ vault, onSignOut }: SettingsScreenProps) {
  const t = useTranslations();
  const mediation = useMediation();
  const [connecting, setConnecting] = useState(false);

  if (connecting) {
    return (
      <MediatorConnectScreen
        onBack={() => setConnecting(false)}
        onConnected={(status) => {
          mediation.adopt(status);
          setConnecting(false);
        }}
      />
    );
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{t.settings.title}</h1>
      </header>

      <MediatorCard mediation={mediation} onConnect={() => setConnecting(true)} />

      <section className="card" aria-labelledby="security-title">
        <h2 className="card__title" id="security-title">
          {t.settings.security.title}
        </h2>
        <dl className="detail-list">
          {vault.digits ? (
            <div className="detail-list__row">
              <dt>{t.settings.security.pinLabel}</dt>
              <dd>{fill(t.settings.security.pinDigits, { digits: vault.digits })}</dd>
            </div>
          ) : null}
          <div className="detail-list__row">
            <dt>{t.settings.security.keptLabel}</dt>
            <dd>
              {vault.home === "store"
                ? t.settings.security.keptInStore
                : t.settings.security.keptInFile}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="security-sign-out">
        <h2 className="card__title" id="security-sign-out">
          {t.settings.security.signOutTitle}
        </h2>
        <div className="button-row">
          <button type="button" className="button button--danger" onClick={onSignOut}>
            {t.settings.security.signOut}
          </button>
        </div>
      </section>
    </div>
  );
}
