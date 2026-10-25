import { useEffect } from "react";

/**
 * Initializes global event listeners to automatically close open track-menu dropdowns when:
 * 1. The user clicks or taps anywhere outside the open menu.
 * 2. An action button/link inside the dropdown popover is clicked.
 * 3. The user presses the Escape key.
 */
export function initClickOutsideMenus(doc: Document = document): () => void {
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let heldMenu: HTMLDetailsElement | null = null;
  let heldPointer: { x: number; y: number } | null = null;
  let suppressClick = false;
  let sheet: HTMLDetailsElement | null = null;
  let consumeBack = false;
  const phone = () => doc.defaultView?.matchMedia("(max-width: 768px)").matches;
  const cancelHold = () => { clearTimeout(holdTimer); heldPointer = null; };
  const handlePointerDown = (e: PointerEvent) => {
    const target = e.target as Node | null;
    if (!target) return;

    const openMenus = doc.querySelectorAll<HTMLDetailsElement>(
      "details.track-menu[open]",
    );
    openMenus.forEach((menu) => {
      if (!menu.contains(target) || menu === target) {
        menu.open = false;
      }
    });
    cancelHold();
    suppressClick = false;
    if (e.pointerType !== "touch" || !(target as Element).closest) return;
    const element = target as Element;
    if (element.closest(".track-actions, summary, .menu-popover, input")) return;
    heldMenu = element.closest(".track-row")?.querySelector("details.track-menu") ?? null;
    if (!heldMenu) return;
    heldPointer = { x: e.clientX, y: e.clientY };
    holdTimer = setTimeout(() => { if (heldMenu) { heldMenu.open = true; suppressClick = true; } }, 450);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (heldPointer && Math.hypot(event.clientX - heldPointer.x, event.clientY - heldPointer.y) > 10) cancelHold();
  };
  const handleTouchClick = (event: MouseEvent) => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
  };
  const handleContextMenu = (event: MouseEvent) => {
    if (phone() && (event.target as Element)?.closest?.(".track-row")) event.preventDefault();
  };

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Close when an action item inside the popover is clicked
    if (target.closest(".menu-popover button, .menu-popover a")) {
      const menu = target.closest<HTMLDetailsElement>("details.track-menu");
      if (menu) {
        menu.open = false;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Tab" && sheet) {
      const items = sheet.querySelectorAll<HTMLButtonElement>(".menu-popover button:not(:disabled), .menu-popover a");
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
    if (e.key === "Escape") {
      if (sheet) e.stopPropagation();
      const openMenus = doc.querySelectorAll<HTMLDetailsElement>(
        "details.track-menu[open]",
      );
      openMenus.forEach((menu) => {
        menu.open = false;
      });
    }
  };

    const handleToggle = (e: Event) => {
    const target = e.target as HTMLElement | null;
    const menu = target?.closest ? target.closest<HTMLDetailsElement>("details.track-menu") : null;
    if (!menu) return;
    if (!menu.open) {
      if (sheet === menu) {
        sheet = null;
        menu.querySelector<HTMLElement>("summary")?.focus();
        if (doc.defaultView?.history.state?.mobileActions) { consumeBack = true; doc.defaultView.history.back(); }
      }
      return;
    }

    const openMenus = doc.querySelectorAll<HTMLDetailsElement>(
      "details.track-menu[open]",
    );
    openMenus.forEach((other) => {
      if (other !== menu) {
        other.open = false;
      }
    });

    if (phone()) {
      sheet = menu;
      const panel = menu.querySelector<HTMLElement>(".menu-popover");
      panel?.setAttribute("role", "dialog");
      panel?.setAttribute("aria-modal", "true");
      panel?.setAttribute("aria-label", menu.querySelector("summary")?.getAttribute("aria-label") || "Track actions");
      doc.defaultView?.history.pushState({ ...doc.defaultView.history.state, mobileActions: true }, "");
      panel?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }

    if (typeof window !== "undefined" && menu.getBoundingClientRect) {
      const rect = menu.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 290 && rect.top > 220) {
        menu.classList.add("open-up");
      } else {
        menu.classList.remove("open-up");
      }
    }
  };

  doc.addEventListener("pointerdown", handlePointerDown);
  doc.addEventListener("click", handleTouchClick, true);
  doc.addEventListener("click", handleClick);
  doc.addEventListener("keydown", handleKeyDown);
  doc.addEventListener("toggle", handleToggle, true);
  doc.addEventListener("pointermove", handlePointerMove);
  doc.addEventListener("pointerup", cancelHold);
  doc.addEventListener("pointercancel", cancelHold);
  doc.addEventListener("contextmenu", handleContextMenu);
  const handleBack = (event: PopStateEvent) => {
    if (!sheet && !consumeBack) return;
    event.stopImmediatePropagation();
    consumeBack = false;
    if (sheet) { sheet.open = false; sheet = null; }
  };
  doc.defaultView?.addEventListener("popstate", handleBack, true);

  return () => {
    cancelHold();
    doc.removeEventListener("pointerdown", handlePointerDown);
    doc.removeEventListener("click", handleClick);
    doc.removeEventListener("keydown", handleKeyDown);
    doc.removeEventListener("toggle", handleToggle, true);
    doc.removeEventListener("pointermove", handlePointerMove);
    doc.removeEventListener("pointerup", cancelHold);
    doc.removeEventListener("pointercancel", cancelHold);
    doc.removeEventListener("click", handleTouchClick, true);
    doc.removeEventListener("contextmenu", handleContextMenu);
    doc.defaultView?.removeEventListener("popstate", handleBack, true);
  };
}

/**
 * React hook to register click-outside listeners for track menus.
 */
export function useClickOutsideMenus() {
  useEffect(() => {
    return initClickOutsideMenus(document);
  }, []);
}
