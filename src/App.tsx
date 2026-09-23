import { useState } from "react";

import { LiquidTabBar, type TabDefinition } from "./components/LiquidTabBar";
import { HomeIcon, MessagesIcon, SettingsIcon } from "./components/icons";
import { useI18n } from "./i18n";
import { useAccent } from "./appearance";
import { useBackdrop } from "./backdrop";
import { useTheme } from "./theme";
import { HomeScreen } from "./screens/HomeScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type Route = "home" | "messages" | "settings";

export default function App() {
  const { t } = useI18n();
  // Applied for the tokens they put on the root element; nothing chooses them
  // yet, so the stored or default palette is what is worn.
  useAccent();
  const { theme } = useTheme();
  // The window behind the page wears the page's colour — see `backdrop`. Read
  // after `useTheme`, because it reads the palette that hook just applied.
  useBackdrop(theme, false);
  const [route, setRoute] = useState<Route>("home");

  const tabs: TabDefinition<Route>[] = [
    { id: "home", label: t.nav.home, icon: <HomeIcon /> },
    { id: "messages", label: t.nav.messages, icon: <MessagesIcon /> },
    { id: "settings", label: t.nav.settings, icon: <SettingsIcon /> },
  ];

  return (
    <div className="app">
      <main className="app__view" key={route}>
        {route === "home" ? <HomeScreen /> : null}
        {route === "messages" ? <MessagesScreen /> : null}
        {route === "settings" ? <SettingsScreen /> : null}
      </main>

      <LiquidTabBar label={t.nav.label} tabs={tabs} active={route} onSelect={setRoute} />
    </div>
  );
}
