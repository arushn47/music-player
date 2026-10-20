import { useEffect } from "react";

/**
 * Initializes global event listeners to automatically close open track-menu dropdowns when:
 * 1. The user clicks or taps anywhere outside the open menu.
 * 2. An action button/link inside the dropdown popover is clicked.
 * 3. The user presses the Escape key.
 */
export function initClickOutsideMenus(doc: Document = document): () => void {
  const handlePointerDown = (e: PointerEvent) => {
    const target = e.target as Node | null;
    if (!target) return;

    const openMenus = doc.querySelectorAll<HTMLDetailsElement>(
      "details.track-menu[open]",
    );
    openMenus.forEach((menu) => {
      if (!menu.contains(target)) {
        menu.open = false;
      }
    });
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
    if (e.key === "Escape") {
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
    if (!menu || !menu.open) return;

    const openMenus = doc.querySelectorAll<HTMLDetailsElement>(
      "details.track-menu[open]",
    );
    openMenus.forEach((other) => {
      if (other !== menu) {
        other.open = false;
      }
    });

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
  doc.addEventListener("click", handleClick);
  doc.addEventListener("keydown", handleKeyDown);
  doc.addEventListener("toggle", handleToggle, true);

  return () => {
    doc.removeEventListener("pointerdown", handlePointerDown);
    doc.removeEventListener("click", handleClick);
    doc.removeEventListener("keydown", handleKeyDown);
    doc.removeEventListener("toggle", handleToggle, true);
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
