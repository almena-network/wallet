import { useState } from "react";

import { AcceptInvitationScreen } from "./AcceptInvitationScreen";
import { ContactScreen } from "./ContactScreen";
import { ConversationScreen } from "./ConversationScreen";
import { InviteScreen } from "./InviteScreen";
import { MessagesScreen } from "./MessagesScreen";
import { NewConversationScreen } from "./NewConversationScreen";

/** Where the Messages tab is: the inbox, or one of the screens it leads to. */
type View =
  | { name: "inbox" }
  | { name: "new" }
  | { name: "invite" }
  | { name: "accept" }
  | { name: "conversation"; id: string; from: "inbox" | "new" }
  | { name: "contact"; id: string; from: "inbox" | "new" };

/** The Messages tab and the screens behind it. Each is left by its own back button. */
export function MessagesTab() {
  const [view, setView] = useState<View>({ name: "inbox" });

  switch (view.name) {
    case "new":
      return (
        <NewConversationScreen
          onBack={() => setView({ name: "inbox" })}
          onOpen={(id) => setView({ name: "conversation", id, from: "new" })}
        />
      );
    case "invite":
      return <InviteScreen onBack={() => setView({ name: "new" })} />;
    case "accept":
      return (
        <AcceptInvitationScreen
          onBack={() => setView({ name: "new" })}
          // Back to the list, which syncs and shows the new contact as pending.
          onAccepted={() => setView({ name: "new" })}
        />
      );
    case "conversation":
      return (
        <ConversationScreen
          id={view.id}
          onBack={() => setView(view.from === "new" ? { name: "new" } : { name: "inbox" })}
          onContact={() => setView({ ...view, name: "contact" })}
        />
      );
    case "contact":
      return (
        <ContactScreen id={view.id} onBack={() => setView({ ...view, name: "conversation" })} />
      );
    default:
      return (
        <MessagesScreen
          onNewConversation={() => setView({ name: "new" })}
          onOpen={(id) => setView({ name: "conversation", id, from: "inbox" })}
        />
      );
  }
}
