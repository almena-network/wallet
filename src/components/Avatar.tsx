import type { ReactNode } from "react";

import { initial } from "../screens/MessagesScreen";

type AvatarProps = {
  /** The picture, as a `data:` URL, when there is one. */
  photo: string | null;
  /** The name whose first letter stands in for a missing picture. */
  name: string | null;
  /** Drawn over the corner — the camera, where the picture can be changed. */
  badge?: ReactNode;
};

/** The identity's round mark: its picture, or the first letter of its name. */
export function Avatar({ photo, name, badge }: AvatarProps) {
  return (
    <span className="avatar">
      {photo ? (
        <img className="avatar__image" src={photo} alt="" />
      ) : (
        <span className="avatar__initial" aria-hidden="true">
          {name ? initial(name) : ""}
        </span>
      )}
      {badge ? (
        <span className="avatar__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </span>
  );
}
