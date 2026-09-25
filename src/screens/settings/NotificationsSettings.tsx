import { CheckIcon } from "../../components/icons";
import { useTranslations } from "../../i18n";
import { privacies, type Privacy } from "../../notify";

type NotificationsSettingsProps = {
  privacy: Privacy;
  onPrivacyChange: (privacy: Privacy) => void;
};

/**
 * How much the system is told when a message arrives with the wallet on the
 * tray or minimised. Each choice says what it shows; the note says where it
 * ends up.
 */
export function NotificationsSettings({ privacy, onPrivacyChange }: NotificationsSettingsProps) {
  const t = useTranslations();

  return (
    <section className="card" aria-labelledby="notifications-privacy">
      <h2 className="card__title" id="notifications-privacy">
        {t.settings.notifications.title}
      </h2>
      <div className="options" role="radiogroup" aria-labelledby="notifications-privacy">
        {privacies.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === privacy}
            className="row"
            onClick={() => onPrivacyChange(option)}
          >
            <span className="row__text">
              <span className="row__label">{t.settings.notifications[option].label}</span>
              <span className="row__hint">{t.settings.notifications[option].hint}</span>
            </span>
            {option === privacy ? <CheckIcon className="row__check" /> : null}
          </button>
        ))}
      </div>
      <p className="card__body">{t.settings.notifications.note}</p>
    </section>
  );
}
