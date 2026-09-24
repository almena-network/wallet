import { useCallback, useEffect, useState } from "react";

import { MessagesIcon, PlusIcon, SyncIcon } from "../components/icons";
import { useI18n } from "../i18n";
import { fill } from "../i18n/format";
import { listContacts, onMessagesChanged, syncMessages, type Contact } from "../contacts";
import { errorCode } from "../mediator";
import { when } from "../when";

type MessagesScreenProps = {
  /** Starts a new conversation. */
  onNewConversation: () => void;
  /** Opens the conversation `id`. */
  onOpen: (id: string) => void;
};

/**
 * The inbox: one row per relationship, the latest activity first. What is on
 * the device is drawn at once; what the mediator is holding is picked up as it
 * opens and whenever the sync button is pressed.
 */
export function MessagesScreen({ onNewConversation, onOpen }: MessagesScreenProps) {
  const { t, locale } = useI18n();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(() => {
    setSyncing(true);
    setError(null);
    return syncMessages()
      .then((synced) => setContacts(synced.contacts))
      .catch((failure) => setError(t.messaging.errors[errorCode(failure)]))
      .finally(() => setSyncing(false));
  }, [t]);

  useEffect(() => {
    listContacts()
      .then((listed) => setContacts((current) => current ?? listed))
      .catch(() => undefined);
    void sync();
  }, [sync]);

  useEffect(() => onMessagesChanged((synced) => setContacts(synced.contacts)), []);

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title screen__title--grow">{t.messages.title}</h1>
        <button
          type="button"
          className="icon-button"
          onClick={() => void sync()}
          disabled={syncing}
          aria-label={t.messages.sync}
        >
          <SyncIcon className={syncing ? "icon-button__spin" : undefined} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onNewConversation}
          aria-label={t.messages.newConversation}
        >
          <PlusIcon />
        </button>
      </header>

      {error ? <p className="card__note card__note--warning">{error}</p> : null}

      {contacts === null ? null : contacts.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            <span className="empty-state__icon">
              <MessagesIcon />
            </span>
            <p className="empty-state__title">{t.messages.empty}</p>
            <p className="empty-state__hint">{t.messages.emptyHint}</p>
          </div>
        </section>
      ) : (
        <section className="list" aria-label={t.messages.title}>
          {contacts.map((contact) => (
            <button
              type="button"
              key={contact.id}
              className={`row message-row${contact.unread > 0 ? " message-row--unread" : ""}`}
              onClick={() => onOpen(contact.id)}
            >
              <span className="row__icon row__icon--initial" aria-hidden="true">
                {initial(contact.name)}
              </span>
              <span className="row__text">
                <span className="row__label">{contact.name}</span>
                <span className="row__hint message-row__preview">
                  {contact.pending
                    ? t.conversations.new.pending
                    : contact.last
                      ? contact.last.mine
                        ? fill(t.messages.mine, { content: contact.last.content })
                        : contact.last.content
                      : t.messages.nothingYet}
                </span>
              </span>
              <span className="message-row__meta">
                <span className="message-row__time">
                  {when(contact.last?.at ?? contact.since, locale)}
                </span>
                {contact.unread > 0 ? (
                  <span className="message-row__count">{contact.unread}</span>
                ) : null}
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

/** The first letter of a name, for the round mark beside it. */
export function initial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "·";
}
