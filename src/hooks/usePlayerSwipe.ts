import { useRef, type PointerEvent, type MouseEvent } from "react";

export function swipeDirection(x: number, y: number): "left" | "right" | "up" | "down" | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < 48) return null;
  if (Math.abs(x) > Math.abs(y) * 1.2) return x < 0 ? "left" : "right";
  if (Math.abs(y) > Math.abs(x) * 1.2) return y < 0 ? "up" : "down";
  return null;
}

export function usePlayerSwipe(actions: {
  left?: () => void; right?: () => void; up?: () => void; down?: () => void;
  drag?: (x: number, y: number) => void; reset?: () => void;
}) {
  const start = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      suppressClick.current = false;
      const target = event.target as Element;
      if (event.button !== 0 || target.closest("button:not(.mobile-cover-expand), input, a, summary, .mobile-np-lyrics-scroll-wrap, .mobile-np-queue-scroll")) return;
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const initial = start.current;
      if (!initial || initial.id !== event.pointerId) return;
      const x = event.clientX - initial.x, y = event.clientY - initial.y;
      if (Math.max(Math.abs(x), Math.abs(y)) > 10) { initial.moved = true; actions.drag?.(x, y); }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const initial = start.current;
      if (!initial || initial.id !== event.pointerId) return;
      start.current = null;
      suppressClick.current = initial.moved;
      const direction = swipeDirection(event.clientX - initial.x, event.clientY - initial.y);
      actions.reset?.();
      if (direction) actions[direction]?.();
    },
    onPointerCancel() { start.current = null; suppressClick.current = true; actions.reset?.(); },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    },
  };
}
