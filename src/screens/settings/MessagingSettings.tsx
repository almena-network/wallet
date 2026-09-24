import { MediatorCard } from "../../components/MediatorCard";
import type { Mediation } from "../../mediator";

type MessagingSettingsProps = {
  mediation: Mediation;
  /** Opens the screen where a mediator is chosen. */
  onConnect: () => void;
};

/** Where the wallet's messages wait: the mediator, and the way to change it. */
export function MessagingSettings({ mediation, onConnect }: MessagingSettingsProps) {
  return <MediatorCard mediation={mediation} onConnect={onConnect} />;
}
