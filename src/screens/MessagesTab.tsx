import { useState } from "react";

import { AcceptInvitationScreen } from "./AcceptInvitationScreen";
import { InviteScreen } from "./InviteScreen";
import { MessagesScreen } from "./MessagesScreen";
import { NewConversationScreen } from "./NewConversationScreen";

/** Where the Messages tab is: the inbox, or one of the screens it leads to. */
type View = "inbox" | "new" | "invite" | "accept";

/** The Messages tab and the screens behind its "+". Each is left by its own back button. */
export function MessagesTab() {
  const [view, setView] = useState<View>("inbox");

  switch (view) {
    case "new":
      return (
        <NewConversationScreen
          onBack={() => setView("inbox")}
          onShowInvitation={() => setView("invite")}
          onAcceptInvitation={() => setView("accept")}
        />
      );
    case "invite":
      return <InviteScreen onBack={() => setView("new")} />;
    case "accept":
      return (
        <AcceptInvitationScreen
          onBack={() => setView("new")}
          // Back to the list, which syncs and shows the new contact as pending.
          onAccepted={() => setView("new")}
        />
      );
    default:
      return <MessagesScreen onNewConversation={() => setView("new")} />;
  }
}
