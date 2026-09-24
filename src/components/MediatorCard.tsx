import { useState } from "react";

import { plural, useI18n } from "../i18n";
import {
  checkMediator,
  disconnectMediator,
  errorCode,
  mediatorName,
  type Mediation,
} from "../mediator";

type MediatorCardProps = {
  mediation: Mediation;
  /** Opens the screen where a mediator is chosen. */
  onConnect: () => void;
};

/**
 * Which mediator holds this wallet's messages, how many it is holding, and the
 * way to connect to one or leave it.
 */
export function MediatorCard({ mediation, onConnect }: MediatorCardProps) {
  const { t, locale } = useI18n();
  const [waiting, setWaiting] = useState<number | null>(null);
  const [busy, setBusy] = useState<"check" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = mediation.status;
  const shownError = error ?? (mediation.error ? t.messaging.errors[mediation.error] : null);

  async function check() {
    setError(null);
    setBusy("check");
    try {
      setWaiting((await checkMediator()).messageCount);
    } catch (failure) {
      setError(t.messaging.errors[errorCode(failure)]);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setError(null);
    setBusy("disconnect");
    try {
      mediation.adopt(await disconnectMediator());
      setWaiting(null);
    } catch (failure) {
      setError(t.messaging.errors[errorCode(failure)]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card" aria-labelledby="mediator-title">
      <h2 className="card__title" id="mediator-title">
        {t.settings.mediator.title}
      </h2>

      {status?.mediator ? (
        <>
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>{t.settings.mediator.nameLabel}</dt>
              <dd>{mediatorName(status.mediator)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>{t.settings.mediator.waitingLabel}</dt>
              <dd>
                {waiting === null
                  ? t.settings.mediator.waitingUnknown
                  : plural(t.settings.mediator.waiting, waiting, locale)}
              </dd>
            </div>
          </dl>
          <div className="button-row">
            <button
              type="button"
              className="button button--primary"
              onClick={() => void check()}
              disabled={busy !== null}
            >
              {busy === "check" ? t.settings.mediator.checking : t.settings.mediator.check}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void disconnect()}
              disabled={busy !== null}
            >
              {t.settings.mediator.disconnect}
            </button>
          </div>
        </>
      ) : status ? (
        <>
          <p className="card__body">{t.settings.mediator.none}</p>
          <div className="button-row">
            <button type="button" className="button button--primary" onClick={onConnect}>
              {t.settings.mediator.connect}
            </button>
          </div>
        </>
      ) : null}

      {shownError ? <p className="card__note card__note--warning">{shownError}</p> : null}
    </section>
  );
}
