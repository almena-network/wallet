import { useEffect, useId, useRef, type ReactNode } from "react";

/** One line of what is being confirmed: what it is, and its value. */
export type ConfirmDetail = {
  label: string;
  value: string;
  /** Set in a monospace face — a fingerprint, an identifier. */
  mono?: boolean;
};

type ConfirmSheetProps = {
  /** The operation's glyph. */
  icon: ReactNode;
  /** Where it came from, said small above the title: a code, a link. */
  origin: string;
  title: string;
  /** One line on what accepting does. */
  lead: string;
  details: ConfirmDetail[];
  /** Said inside the sheet, for what stops or qualifies accepting. */
  note?: string | null;
  error?: string | null;
  cancelLabel: string;
  confirmLabel: string;
  /** Accepting is not possible — the note says why. */
  confirmDisabled?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * A question that came from outside — a scanned code, an opened link — put
 * to the person over whatever screen was open, with two answers.
 *
 * **Only what is known is shown.** The details are what the wallet actually
 * read, never a guess at them, and nothing happens until Accept is pressed.
 * Cancelling is as easy as accepting: the same size, the backdrop, Escape.
 */
export function ConfirmSheet({
  icon,
  origin,
  title,
  lead,
  details,
  note,
  error,
  cancelLabel,
  confirmLabel,
  confirmDisabled = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmSheetProps) {
  const titleId = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const latest = useRef(onCancel);
  latest.current = onCancel;

  // Focus lands on the safe answer, and Escape is Cancel.
  useEffect(() => {
    cancel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        latest.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={busy ? undefined : onCancel} aria-hidden="true" />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="sheet__grip" aria-hidden="true" />
        <span className="sheet__icon" aria-hidden="true">
          {icon}
        </span>
        <p className="sheet__origin">{origin}</p>
        <h2 className="sheet__title" id={titleId}>
          {title}
        </h2>
        <p className="sheet__lead">{lead}</p>

        {details.length > 0 ? (
          <dl className="detail-list sheet__details">
            {details.map((detail) => (
              <div className="detail-list__row" key={detail.label}>
                <dt>{detail.label}</dt>
                <dd className={detail.mono ? "detail-list__mono" : undefined}>{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {note ? <p className="card__note">{note}</p> : null}
        {error ? <p className="card__note card__note--warning">{error}</p> : null}

        <div className="button-row button-row--split">
          <button ref={cancel} type="button" className="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? <span className="spinner spinner--inline" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
