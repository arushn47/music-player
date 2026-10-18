import { describe, it, expect, vi } from "vitest";
import { initClickOutsideMenus } from "./useClickOutsideMenus";

describe("initClickOutsideMenus", () => {
  it("closes open track-menu details when pointerdown fires outside", () => {
    const listeners: Record<string, EventListener> = {};
    const mockDetails = {
      open: true,
      contains: vi.fn((target: any) => target === "inside"),
    };
    const mockDoc = {
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        listeners[event] = listener;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete listeners[event];
      }),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === "details.track-menu[open]") {
          return mockDetails.open ? [mockDetails] : [];
        }
        return [];
      }),
    } as unknown as Document;

    const cleanup = initClickOutsideMenus(mockDoc);
    expect(mockDoc.addEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function));
    expect(mockDoc.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    expect(mockDoc.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));

    // Pointer down outside: target is 'outside'
    listeners.pointerdown({ target: "outside" as any } as PointerEvent);
    expect(mockDetails.open).toBe(false);

    cleanup();
    expect(mockDoc.removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function));
  });

  it("does not close open track-menu when clicking inside", () => {
    const listeners: Record<string, EventListener> = {};
    const mockDetails = {
      open: true,
      contains: vi.fn((target: any) => target === "inside"),
    };
    const mockDoc = {
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        listeners[event] = listener;
      }),
      removeEventListener: vi.fn(),
      querySelectorAll: vi.fn(() => [mockDetails]),
    } as unknown as Document;

    initClickOutsideMenus(mockDoc);

    // Pointer down inside: target is 'inside'
    listeners.pointerdown({ target: "inside" as any } as PointerEvent);
    expect(mockDetails.open).toBe(true);
  });

  it("closes open track-menu when clicking an action item inside popover", () => {
    const listeners: Record<string, EventListener> = {};
    const mockDetails = {
      open: true,
      contains: vi.fn(() => true),
    };
    const mockTarget = {
      closest: vi.fn((selector: string) => {
        if (selector === ".menu-popover button, .menu-popover a") return true;
        if (selector === "details.track-menu") return mockDetails;
        return null;
      }),
    };
    const mockDoc = {
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        listeners[event] = listener;
      }),
      removeEventListener: vi.fn(),
      querySelectorAll: vi.fn(() => [mockDetails]),
    } as unknown as Document;

    initClickOutsideMenus(mockDoc);

    listeners.click({ target: mockTarget as any } as MouseEvent);
    expect(mockDetails.open).toBe(false);
  });

  it("closes open track-menu on Escape key", () => {
    const listeners: Record<string, EventListener> = {};
    const mockDetails = {
      open: true,
    };
    const mockDoc = {
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        listeners[event] = listener;
      }),
      removeEventListener: vi.fn(),
      querySelectorAll: vi.fn(() => [mockDetails]),
    } as unknown as Document;

    initClickOutsideMenus(mockDoc);

    listeners.keydown({ key: "Escape" } as KeyboardEvent);
    expect(mockDetails.open).toBe(false);
  });
});
