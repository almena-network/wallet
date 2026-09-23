import { MessagesIcon } from "../components/icons";
import { useTranslations } from "../i18n";

export function MessagesScreen() {
  const t = useTranslations();

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{t.messages.title}</h1>
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
