import { SettingsIcon } from "../components/icons";
import { useTranslations } from "../i18n";

export function SettingsScreen() {
  const t = useTranslations();

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{t.settings.title}</h1>
      </header>

      <section className="card">
        <div className="empty-state">
          <span className="empty-state__icon">
            <SettingsIcon />
          </span>
          <p className="empty-state__title">{t.settings.empty}</p>
        </div>
      </section>
    </div>
  );
}
