import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ContextMenuItem = {
  label: string;
  onSelect: () => void;
  /** Said in the danger colour: it destroys something. */
  danger?: boolean;
};

type ContextMenuProps = {
  /** Where it was asked for, in viewport pixels. */
  x: number;
  y: number;
  label: string;
  items: ContextMenuItem[];
  onClose: () => void;
};

/**
 * The menu a right click opens, at the pointer and kept inside the window.
 * Anything else — a click elsewhere, Escape, a scroll, the window losing
 * focus — closes it.
 */
export function ContextMenu({ x, y, label, items, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (box) {
      setAt({
        left: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)),
        top: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)),
      });
    }
    menu.current?.querySelector("button")?.focus();
  }, [x, y]);

  useEffect(() => {
    const outside = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("contextmenu", outside, true);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("contextmenu", outside, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menu}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={{ left: at.left, top: at.top }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`context-menu__item${item.danger ? " context-menu__item--danger" : ""}`}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
