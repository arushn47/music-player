import { expect, it } from "vitest";
import { swipeDirection } from "./usePlayerSwipe";

it("recognizes deliberate player swipes without treating taps or diagonal scrolling as track changes", () => {
  expect(swipeDirection(-90, 12)).toBe("left");
  expect(swipeDirection(90, 10)).toBe("right");
  expect(swipeDirection(10, -90)).toBe("up");
  expect(swipeDirection(8, 90)).toBe("down");
  expect(swipeDirection(20, 10)).toBeNull();
  expect(swipeDirection(70, 70)).toBeNull();
});
