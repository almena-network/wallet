import { useEffect, useState } from "react";

import { Avatar } from "./Avatar";
import { useTranslations } from "../i18n";
import { readPhoto, readProfile } from "../contacts";

/**
 * The top of the profile tab: the identity's picture and, under it, the name
 * it goes by. Only shown here; both are changed in the Profile section.
 */
export function ProfileHeader() {
  const t = useTranslations();
  const [name, setName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    readProfile()
      .then((profile) => setName(profile.name))
      .catch(() => undefined);
    readPhoto()
      .then(setPhoto)
      .catch(() => undefined);
  }, []);

  return (
    <section className="profile-header">
      <Avatar photo={photo} name={name} />
      <h1 className={`profile-header__name${name ? "" : " profile-header__name--none"}`}>
        {name ?? t.profile.noName}
      </h1>
    </section>
  );
}
