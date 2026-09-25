import { useRef, useState, type ReactNode } from "react";

/** How far the row slides to uncover its action, in pixels. */
const ACTION_WIDTH = 96;
/** How far a finger moves before it counts as a drag rather than a tap. */
const SLOP = 8;

type SwipeRowProps = {
  /** The row's own content, drawn inside its button. */
  children: ReactNode;
  className: string;
  /** Whether the action is uncovered. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What a tap does while the action is covered. */
  onPress: () => void;
  onContextMenu: (x: number, y: number) => void;
  actionLabel: string;
  onAction: () => void;
};

/**
 * A row that a finger drags to the left to uncover one action behind it, the
 * way a phone's own lists do. A mouse does not drag it: on a computer the same
 * action is in the menu a right click opens, which `onContextMenu` is told
 * about with where to put it.
 *
 * **Vertical is the list's, horizontal is the row's.** `touch-action: pan-y`
 * leaves scrolling to the browser, and a drag is only taken once it is plainly
 * sideways, so a slightly crooked scroll never slides a row.
 */
export function SwipeRow({
  children,
  className,
  open,
  onOpenChange,
  onPress,
  onContextMenu,
  actionLabel,
  onAction,
}: SwipeRowProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    from: number;
    sideways: boolean | null;
  } | null>(null);
  // A drag ends with a click on the row, which must not open it.
  const dragged = useRef(false);

  const offset = drag ?? (open ? -ACTION_WIDTH : 0);

  return (
    <div className="swipe-row">
      <button
        type="button"
        className="swipe-row__action"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={onAction}
      >
        {actionLabel}
      </button>
      <button
        type="button"
        className={`${className} swipe-row__front${drag === null ? "" : " swipe-row__front--dragging"}`}
        style={{ transform: offset === 0 ? undefined : `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") {
            return;
          }
          dragged.current = false;
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            from: open ? -ACTION_WIDTH : 0,
            sideways: null,
          };
        }}
        onPointerMove={(event) => {
          const at = gesture.current;
          if (!at || at.id !== event.pointerId) {
            return;
          }
          const dx = event.clientX - at.x;
          const dy = event.clientY - at.y;
          if (at.sideways === null) {
            if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) {
              return;
            }
            at.sideways = Math.abs(dx) > Math.abs(dy);
            if (at.sideways) {
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }
          if (at.sideways) {
            dragged.current = true;
            setDrag(Math.min(0, Math.max(-ACTION_WIDTH * 1.25, at.from + dx)));
          }
        }}
        onPointerUp={() => {
          gesture.current = null;
          if (drag !== null) {
            onOpenChange(drag < -ACTION_WIDTH / 2);
            setDrag(null);
          }
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDrag(null);
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
          } else if (open) {
            onOpenChange(false);
          } else {
            onPress();
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (gesture.current || dragged.current) {
            return;
          }
          // The keyboard's menu key says nowhere; the row's corner stands in.
          if (event.clientX === 0 && event.clientY === 0) {
            const box = event.currentTarget.getBoundingClientRect();
            onContextMenu(box.left + 16, box.bottom);
          } else {
            onContextMenu(event.clientX, event.clientY);
          }
        }}
      >
        {children}
      </button>
    </div>
  );
}
