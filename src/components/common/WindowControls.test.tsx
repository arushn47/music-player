import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { WindowControls } from "./WindowControls";

it("renders native controls without a separate title bar or draggable buttons", () => {
  const html = renderToStaticMarkup(<WindowControls onError={() => {}} />);
  expect(html).toContain('aria-label="Window controls"');
  for (const action of ["Minimize", "Maximize", "Close"])
    expect(html).toContain(`aria-label="${action} window"`);
  expect(html).not.toContain("data-tauri-drag-region");
  expect(html).not.toContain("<header");
});

it("allows custom window controls only in the main undecorated window", () => {
  const capability = JSON.parse(
    readFileSync("src-tauri/capabilities/main.json", "utf8"),
  );
  expect(capability.windows).toEqual(["main"]);
  for (const command of [
    "start-dragging",
    "minimize",
    "toggle-maximize",
    "close",
  ])
    expect(capability.permissions).toContain(`core:window:allow-${command}`);
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  expect(
    config.app.windows.find((win: { label: string }) => win.label === "main")
      .decorations,
  ).toBe(false);
});
