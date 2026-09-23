import { CredentialIcon } from "../components/icons";
import { useTranslations } from "../i18n";

export function HomeScreen() {
  const t = useTranslations();

  return (
    <div className="screen">
      <header className="screen__header">
        <img className="brand-mark" src="/brand/app-icon.png" alt="" />
        <div>
          <p className="screen__eyebrow">{t.app.name}</p>
          <h1 className="screen__title">{t.home.greeting}</h1>
        </div>
      </header>

      <section className="card" aria-labelledby="home-credentials">
        <h2 className="card__title" id="home-credentials">
          {t.home.credentials.title}
        </h2>
        <div className="empty-state">
          <span className="empty-state__icon">
            <CredentialIcon />
          </span>
          <p className="empty-state__title">{t.home.credentials.empty}</p>
          <p className="empty-state__hint">{t.home.credentials.emptyHint}</p>
        </div>
      </section>
    </div>
  );
}
