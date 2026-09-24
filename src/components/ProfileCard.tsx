import { useEffect, useState } from "react";

import { useI18n } from "../i18n";
import { plural } from "../i18n/format";
import { NAME_CHARS, readProfile, writeProfile } from "../contacts";
import { errorCode } from "../mediator";

/**
 * The name this wallet goes by. It is sent to each contact over the address
 * that contact knows, so it links nothing, and a change reaches all of them.
 */
export function ProfileCard() {
  const { t, locale } = useI18n();
  const [saved, setSaved] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readProfile()
      .then((profile) => {
        setSaved(profile.name);
        setName(profile.name ?? "");
      })
      .catch((failure) => setError(t.messaging.errors[errorCode(failure)]));
  }, [t]);

  async function save() {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const profile = await writeProfile(name.trim() || null);
      setSaved(profile.name);
      setName(profile.name ?? "");
      setNote(
        profile.unreached > 0
          ? plural(t.settings.profile.unreached, profile.unreached, locale)
          : t.settings.profile.saved,
      );
    } catch (failure) {
      setError(t.messaging.errors[errorCode(failure)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card"
      aria-labelledby="profile-title"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2 className="card__title" id="profile-title">
        {t.settings.profile.title}
      </h2>
      <p className="card__body">{t.settings.profile.hint}</p>
      <label className="field">
        <span className="field__label">{t.settings.profile.label}</span>
        <input
          className="field__input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNote(null);
          }}
          placeholder={t.settings.profile.placeholder}
          maxLength={NAME_CHARS}
          autoComplete="nickname"
        />
      </label>
      <div className="button-row">
        <button
          type="submit"
          className="button button--primary"
          disabled={busy || name.trim() === (saved ?? "")}
        >
          {busy ? t.settings.profile.saving : t.settings.profile.save}
        </button>
      </div>
      {note ? <p className="card__note">{note}</p> : null}
      {error ? <p className="card__note card__note--warning">{error}</p> : null}
    </form>
  );
}
