import { useCallback, useState } from "react";

import { BrandSpinner } from "./components/BrandSpinner";
import { LiquidTabBar, type TabDefinition } from "./components/LiquidTabBar";
import { HomeIcon, MessagesIcon, SettingsIcon } from "./components/icons";
import { plural, useI18n } from "./i18n";
import { useAccent } from "./appearance";
import { useBackdrop } from "./backdrop";
import { forgetIdentity, type Identity } from "./identity";
import { useTheme } from "./theme";
import { destroyVault, errorCode as vaultErrorCode, openVault, useVault } from "./vault";
import { HomeScreen } from "./screens/HomeScreen";
import { LogoutScreen } from "./screens/LogoutScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { PinScreen } from "./screens/PinScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { Onboarding } from "./screens/onboarding/Onboarding";

type Route = "home" | "messages" | "settings";

export default function App() {
  const { t, locale } = useI18n();
  // Applied for the tokens they put on the root element; nothing chooses them
  // yet, so the stored or default palette is what is worn.
  useAccent();
  const { theme } = useTheme();
  // The window behind the page wears the page's colour — see `backdrop`. Read
  // after `useTheme`, because it reads the palette that hook just applied.
  useBackdrop(theme, false);
  const vault = useVault();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [route, setRoute] = useState<Route>("home");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  // Signing out is reachable from Settings, from behind the lock and from a
  // record that cannot be opened; it is one screen whichever way it is reached.
  const [signOutAsked, setSignOutAsked] = useState(false);

  // Signing out is not locking: the record itself goes, and the phrase is what
  // is left.
  const signOut = useCallback(async () => {
    setRoute("home");
    setSignOutAsked(false);
    setIdentity(null);
    setUnlockError(null);
    void forgetIdentity();
    vault.adopt(await destroyVault().catch(() => vault.status));
  }, [vault]);

  const unlock = useCallback(
    async (pin: string) => {
      setUnlockError(null);
      setUnlockBusy(true);
      try {
        setIdentity(await openVault(pin));
      } catch (failure) {
        setUnlockError(t.vault.errors[vaultErrorCode(failure)]);
        // The count of what is left changed, and a record spent to its last
        // attempt is gone — which the welcome screen has to be told about.
        void vault.refresh();
      } finally {
        setUnlockBusy(false);
      }
    },
    [t, vault],
  );

  // Nothing is drawn on a guess: whether this device holds an identity decides
  // between the way in and the lock.
  if (!vault.read) {
    return (
      <div className="app">
        <main className="app__view app__view--plain">
          <BrandSpinner label={t.app.name} />
        </main>
      </div>
    );
  }

  if (signOutAsked) {
    return (
      <div className="app">
        <main className="app__view app__view--plain">
          <LogoutScreen onBack={() => setSignOutAsked(false)} onConfirmed={() => void signOut()} />
        </main>
      </div>
    );
  }

  // There is something where the record goes and this wallet cannot read it. The
  // one thing that must not happen here is the welcome screen: offering to create
  // an identity would write a second one over the first.
  if (vault.status.problem) {
    return (
      <div className="app">
        <main className="app__view app__view--plain">
          <div className="screen">
            <header className="screen__header">
              <h1 className="screen__title">{t.vault.problem.title}</h1>
            </header>
            <p className="screen__intro">{t.vault.errors[vault.status.problem]}</p>
            <section className="card">
              <p className="card__body">{t.vault.problem.body}</p>
              <div className="button-row">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void vault.refresh()}
                >
                  {t.vault.problem.retry}
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => setSignOutAsked(true)}
                >
                  {t.settings.security.signOut}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  // No identity on this device: the way in is the only thing there is.
  if (!vault.status.exists) {
    return (
      <div className="app">
        <main className="app__view app__view--plain">
          <Onboarding
            onReady={(made) => {
              setIdentity(made);
              void vault.refresh();
            }}
          />
        </main>
      </div>
    );
  }

  // There is one, and it is not open. The only ways past are the PIN and
  // signing out to start again from the words.
  if (!identity) {
    return (
      <div className="app">
        <main className="app__view app__view--plain">
          <PinScreen
            title={t.pin.unlockTitle}
            subtitle={t.pin.unlockSubtitle}
            digits={vault.status.digits ?? 4}
            error={unlockError}
            busy={unlockBusy}
            busyLabel={t.pin.checking}
            onComplete={(code) => {
              void unlock(code);
            }}
            footer={
              <>
                {/* Said only once it is worth saying. A wallet that counts down
                    from ten at every launch reads as broken; one that says
                    nothing lets somebody destroy an identity by guessing. */}
                {vault.status.attemptsLeft <= 3 ? (
                  <p className="card__note card__note--warning">
                    {plural(t.pin.attemptsLeft, vault.status.attemptsLeft, locale)}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => setSignOutAsked(true)}
                >
                  {t.settings.security.signOut}
                </button>
              </>
            }
          />
        </main>
      </div>
    );
  }

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
        {route === "settings" ? (
          <SettingsScreen vault={vault.status} onSignOut={() => setSignOutAsked(true)} />
        ) : null}
      </main>

      <LiquidTabBar label={t.nav.label} tabs={tabs} active={route} onSelect={setRoute} />
    </div>
  );
}
