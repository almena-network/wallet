import { useEffect, useState } from "react";

import { ConfirmSheet, type ConfirmDetail } from "../components/ConfirmSheet";
import { ProfileIcon, ServerIcon } from "../components/icons";
import { useI18n } from "../i18n";
import { plural } from "../i18n/format";
import { acceptInvitation } from "../contacts";
import { linkDetails, type LinkDetails } from "../links";
import { connectMediator, errorCode, mediatorName } from "../mediator";

/** Where a link or a code came from, said at the top of the sheet. */
export type LinkOrigin = "qr" | "link";

type LinkSheetProps = {
  url: string;
  origin: LinkOrigin;
  onClose: () => void;
  /** A relationship was opened, or an existing one asked for: its conversation. */
  onConversation: (id: string | null) => void;
  /** The wallet now uses the mediator the link named. */
  onMediatorConnected: () => void;
};

/**
 * What a scanned code or an opened link asks, put to the person over the open
 * screen: somebody's invitation, or a mediator's. The details come from the
 * Rust side, which reads the link without acting on it; Accept is what acts.
 */
export function LinkSheet({
  url,
  origin,
  onClose,
  onConversation,
  onMediatorConnected,
}: LinkSheetProps) {
  const { t, locale } = useI18n();
  const [details, setDetails] = useState<LinkDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    linkDetails(url)
      .then(setDetails)
      .catch(() => setDetails({ kind: "unknown" }));
  }, [url]);

  // Nothing the wallet can read: there is no question to ask.
  useEffect(() => {
    if (details?.kind === "unknown") {
      onClose();
    }
  }, [details, onClose]);

  if (details === null || details.kind === "unknown") {
    return null;
  }

  const common = {
    origin: t.confirm.origin[origin],
    cancelLabel: t.confirm.cancel,
    error,
    busy,
    onCancel: onClose,
  };

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(t.messaging.errors[errorCode(failure)]);
      setBusy(false);
    }
  }

  if (details.kind === "contact") {
    const existing = details.contact;
    const rows: ConfirmDetail[] = [
      { label: t.confirm.contact.fingerprint, value: details.fingerprint, mono: true },
      existing
        ? { label: t.confirm.contact.existing, value: existing.name }
        : { label: t.confirm.contact.reach, value: t.confirm.contact.reachValue },
    ];
    return (
      <ConfirmSheet
        {...common}
        icon={<ProfileIcon />}
        title={t.confirm.contact.title}
        lead={t.confirm.contact.lead}
        details={rows}
        note={details.own ? t.confirm.contact.own : null}
        confirmDisabled={details.own}
        confirmLabel={existing ? t.confirm.contact.open : t.confirm.accept}
        onConfirm={() =>
          existing
            ? onConversation(existing.id)
            : void act(async () => {
                const opened = await acceptInvitation(url);
                onConversation(opened.id);
              })
        }
      />
    );
  }

  const same = details.current === details.mediator;
  // A new mediator would leave every relationship's DIDs routed through the
  // old one, which the wallet would no longer collect from.
  const blocked = !same && details.current !== null && details.contacts > 0;
  const rows: ConfirmDetail[] = [
    { label: t.confirm.mediator.mediator, value: mediatorName(details.mediator) },
    {
      label: t.confirm.mediator.current,
      value: details.current ? mediatorName(details.current) : t.confirm.mediator.none,
    },
  ];
  return (
    <ConfirmSheet
      {...common}
      icon={<ServerIcon />}
      title={t.confirm.mediator.title}
      lead={t.confirm.mediator.lead}
      details={rows}
      note={
        same
          ? t.confirm.mediator.same
          : blocked
            ? plural(t.confirm.mediator.blocked, details.contacts, locale)
            : null
      }
      confirmDisabled={same || blocked}
      confirmLabel={t.confirm.accept}
      onConfirm={() =>
        void act(async () => {
          await connectMediator(url);
          onMediatorConnected();
        })
      }
    />
  );
}
