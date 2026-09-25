import { useEffect, useRef, useState } from "react";

import {
  HangUpIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  VideoIcon,
  VideoOffIcon,
} from "../components/icons";
import { useI18n } from "../i18n";
import { calls, type CallView } from "../call";
import { initial } from "./MessagesScreen";

/**
 * The call, over everything else, the tab bar included: who it is with, how
 * it stands, and the controls that apply now — answer or decline while it
 * rings, mute, camera and hang up once it is on.
 *
 * In a video call the other side fills the screen and this side sits in a
 * corner; until their picture arrives, and in a voice call, their initial
 * stands in for it.
 */
export function CallScreen({ view }: { view: CallView }) {
  const { t } = useI18n();
  const video = view.media === "video";
  const seeing = video && view.remote !== null && view.phase !== "ended";

  return (
    <div className={`call${seeing ? " call--video" : ""}`} role="dialog" aria-modal="true" aria-label={view.name}>
      {video ? <Stream className="call__remote" stream={view.remote} hidden={!seeing} /> : null}
      {/* A voice call still needs somewhere for the other side's sound to play. */}
      {!video ? <Stream className="call__audio" stream={view.remote} audioOnly /> : null}

      <div className="call__who">
        {seeing ? null : (
          <span className="call__avatar" aria-hidden="true">
            {initial(view.name)}
          </span>
        )}
        <h1 className="call__name">{view.name}</h1>
        <p className="call__status" aria-live="polite">
          <Status view={view} />
        </p>
      </div>

      {video && view.local && view.phase !== "ended" ? (
        <Stream className="call__local" stream={view.local} muted hidden={!view.cameraOn} />
      ) : null}

      <div className="call__controls">
        {view.phase === "incoming" ? (
          <>
            <button type="button" className="call__button call__button--end" onClick={() => calls.decline()}>
              <HangUpIcon />
              <span>{t.calls.decline}</span>
            </button>
            <button type="button" className="call__button call__button--accept" onClick={() => void calls.accept()}>
              {video ? <VideoIcon /> : <PhoneIcon />}
              <span>{t.calls.accept}</span>
            </button>
          </>
        ) : view.phase === "ended" ? null : (
          <>
            <button
              type="button"
              className={`call__button${view.micOn ? "" : " call__button--off"}`}
              onClick={() => calls.toggleMic()}
              disabled={!view.local}
              aria-pressed={!view.micOn}
            >
              {view.micOn ? <MicIcon /> : <MicOffIcon />}
              <span>{view.micOn ? t.calls.mute : t.calls.unmute}</span>
            </button>
            {video ? (
              <button
                type="button"
                className={`call__button${view.cameraOn ? "" : " call__button--off"}`}
                onClick={() => calls.toggleCamera()}
                disabled={!view.local}
                aria-pressed={!view.cameraOn}
              >
                {view.cameraOn ? <VideoIcon /> : <VideoOffIcon />}
                <span>{view.cameraOn ? t.calls.cameraOff : t.calls.cameraOn}</span>
              </button>
            ) : null}
            <button type="button" className="call__button call__button--end" onClick={() => calls.hangUp()}>
              <HangUpIcon />
              <span>{t.calls.hangUp}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Status({ view }: { view: CallView }) {
  const { t } = useI18n();
  switch (view.phase) {
    case "outgoing":
      return <>{t.calls.calling}</>;
    case "incoming":
      return <>{view.media === "video" ? t.calls.incomingVideo : t.calls.incomingAudio}</>;
    case "connecting":
      return <>{t.calls.connecting}</>;
    case "active":
      return <Duration since={view.since ?? Date.now()} />;
    case "ended": {
      const outcome = view.outcome;
      if (!outcome || outcome.kind === "missed") {
        return <>{outcome ? t.calls.ended.missed : t.calls.ended.ended}</>;
      }
      if (outcome.kind === "hangup") {
        return <>{t.calls.ended[outcome.reason]}</>;
      }
      const code = outcome.code;
      return (
        <>
          {code === "call_media" || code === "call_relay" || code === "call_failed"
            ? t.calls.errors[code]
            : t.messaging.errors[code]}
        </>
      );
    }
  }
}

/** Minutes and seconds since the media started flowing, ticking. */
function Duration({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const minutes = Math.floor(seconds / 60);
  return (
    <span className="call__duration">
      {minutes}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

/** A media stream in a `<video>` (or an `<audio>`), playing inline. */
function Stream({
  className,
  stream,
  muted = false,
  hidden = false,
  audioOnly = false,
}: {
  className: string;
  stream: MediaStream | null;
  muted?: boolean;
  hidden?: boolean;
  audioOnly?: boolean;
}) {
  const element = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    if (element.current && element.current.srcObject !== stream) {
      element.current.srcObject = stream;
    }
  }, [stream]);
  return audioOnly ? (
    <audio ref={element} className={className} autoPlay />
  ) : (
    <video ref={element} className={className} autoPlay playsInline muted={muted} hidden={hidden} />
  );
}
