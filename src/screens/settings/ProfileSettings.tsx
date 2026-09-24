import { PhotoEditor } from "../../components/PhotoEditor";
import { ProfileCard } from "../../components/ProfileCard";

/** The identity as it is shown: its picture, and the name it goes by. */
export function ProfileSettings() {
  return (
    <>
      <PhotoEditor />
      <ProfileCard />
    </>
  );
}
