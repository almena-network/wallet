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
    </div>
  );
}
