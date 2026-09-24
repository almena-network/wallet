import { useEffect, useState } from "react";

import { ChevronLeftIcon, MessagesIcon, QrIcon } from "../components/icons";
import { fill, useI18n } from "../i18n";
import { listContacts, syncMessages, type Contact } from "../contacts";
import { errorCode } from "../mediator";

type NewConversationScreenProps = {
  onBack: () => void;
  /** Opens this wallet's own invitation, as a code and a link. */
  onShowInvitation: () => void;
  /** Opens the screen where somebody else's invitation is pasted. */
  onAcceptInvitation: () => void;
};

/**
 * Where a conversation starts: with somebody this wallet already has a
 * relationship with, with somebody found in the directory, or with somebody in
 * front of it — by showing an invitation or reading theirs.
 *
 * It syncs as it opens, so a relationship somebody opened by accepting this
 * wallet's invitation is in the list by the time it is drawn.
 */
export function NewConversationScreen({
  onBack,
  onShowInvitation,
  onAcceptInvitation,
}: NewConversationScreenProps) {
  const { t, locale } = useI18n();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let current = true;
    listContacts()
      .then((listed) => current && setContacts(listed))
      .catch(() => undefined);
    syncMessages()
      .then((synced) => current && setContacts(synced.contacts))
      .catch((failure) => current && setError(t.messaging.errors[errorCode(failure)]));
    return () => {
      current = false;
    };
  }, [t]);

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="screen">
      <header className="screen__header screen__header--compact">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t.nav.back}>
          <ChevronLeftIcon />
        </button>
        <h1 className="screen__title screen__title--compact">{t.conversations.new.title}</h1>
      </header>

      {error ? <p className="card__note card__note--warning">{error}</p> : null}

      <section className="card" aria-labelledby="new-contacts">
        <h2 className="card__title" id="new-contacts">
          {t.conversations.new.contacts}
        </h2>
        {contacts === null ? null : contacts.length === 0 ? (
          <p className="card__body">{t.conversations.new.empty}</p>
        ) : (
          contacts.map((contact) => (
            <div className="row" key={contact.id}>
              <span className="row__icon">
                <MessagesIcon />
              </span>
              <span className="row__text">
                <span className="row__label">{contact.name}</span>
                <span className="row__hint">
                  {contact.pending
                    ? t.conversations.new.pending
                    : fill(t.conversations.new.since, {
                        date: date.format(new Date(contact.since * 1000)),
                      })}
                </span>
              </span>
            </div>
          ))
        )}
      </section>

      <form
        className="card"
        aria-labelledby="new-directory"
        onSubmit={(event) => {
          event.preventDefault();
          setSearched(true);
        }}
      >
        <h2 className="card__title" id="new-directory">
          {t.conversations.new.directory.title}
        </h2>
        <label className="field">
          <span className="field__label">{t.conversations.new.directory.label}</span>
          <input
            className="field__input"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearched(false);
            }}
            placeholder={t.conversations.new.directory.placeholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {/* The directory is not published yet; the search is here so the
            screen has its final shape, and says so when it is used. */}
        {searched ? (
          <p className="card__note">{t.conversations.new.directory.unavailable}</p>
        ) : null}
        <div className="button-row">
          <button
            type="submit"
            className="button"
            disabled={query.trim().length === 0}
          >
            {t.conversations.new.directory.search}
          </button>
        </div>
      </form>

      <section className="card" aria-labelledby="new-invite">
        <h2 className="card__title" id="new-invite">
          {t.conversations.new.invite.title}
        </h2>
        <p className="card__body">{t.conversations.new.invite.hint}</p>
        <div className="button-row">
          <button type="button" className="button button--primary button--icon" onClick={onShowInvitation}>
            <QrIcon />
            {t.conversations.new.invite.show}
          </button>
          <button type="button" className="button" onClick={onAcceptInvitation}>
            {t.conversations.new.invite.accept}
          </button>
        </div>
      </section>
    </div>
  );
}
