import { MessagesIcon, PlusIcon } from "../components/icons";
import { useTranslations } from "../i18n";

type MessagesScreenProps = {
  /** Starts a new conversation. */
  onNewConversation: () => void;
};

export function MessagesScreen({ onNewConversation }: MessagesScreenProps) {
  const t = useTranslations();

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title screen__title--grow">{t.messages.title}</h1>
        <button
          type="button"
          className="icon-button"
          onClick={onNewConversation}
          aria-label={t.messages.newConversation}
        >
          <PlusIcon />
        </button>
      </header>

      <section className="card">
        <div className="empty-state">
          <span className="empty-state__icon">
            <MessagesIcon />
          </span>
          <p className="empty-state__title">{t.messages.empty}</p>
          <p className="empty-state__hint">{t.messages.emptyHint}</p>
        </div>
      </section>
    </div>
  );
}
