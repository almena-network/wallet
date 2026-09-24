import { useEffect, useRef, useState } from "react";

import { Avatar } from "./Avatar";
import { CameraIcon } from "./icons";
import { useTranslations } from "../i18n";
import { readPhoto, readProfile, writePhoto } from "../contacts";
import { errorCode } from "../mediator";
import { shrinkPhoto } from "../photo";

/**
 * The identity's picture, where it is changed: touching it opens the system's
 * picker, and one that is there can be taken away. It stays on this device.
 */
export function PhotoEditor() {
  const t = useTranslations();
  const [name, setName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    readProfile()
      .then((profile) => setName(profile.name))
      .catch(() => undefined);
    readPhoto()
      .then(setPhoto)
      .catch(() => undefined);
  }, []);

  async function change(file: File) {
    setBusy(true);
    setError(null);
    try {
      const small = await shrinkPhoto(file).catch(() => {
        throw "photo_unreadable";
      });
      await writePhoto(small);
      setPhoto(small);
    } catch (failure) {
      setError(
        failure === "photo_unreadable"
          ? t.profile.photoUnreadable
          : t.messaging.errors[errorCode(failure)],
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await writePhoto(null);
      setPhoto(null);
    } catch (failure) {
      setError(t.messaging.errors[errorCode(failure)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-header">
      <button
        type="button"
        className="avatar-button"
        onClick={() => picker.current?.click()}
        disabled={busy}
        aria-label={t.profile.changePhoto}
      >
        <Avatar photo={photo} name={name} badge={<CameraIcon />} />
      </button>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared, so choosing the same picture again still counts.
          event.target.value = "";
          if (file) {
            void change(file);
          }
        }}
      />

      <div className="button-row">
        <button
          type="button"
          className="profile-header__action"
          onClick={() => picker.current?.click()}
          disabled={busy}
        >
          {t.profile.changePhoto}
        </button>
        {photo ? (
          <button
            type="button"
            className="profile-header__action"
            onClick={() => void remove()}
            disabled={busy}
          >
            {t.profile.removePhoto}
          </button>
        ) : null}
      </div>

      {error ? <p className="card__note card__note--warning">{error}</p> : null}
    </section>
  );
}
