import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GeminiKeySettings } from "./GeminiKeySettings";

it("provides a masked key input and keeps an empty submission disabled", () => {
  const html = renderToStaticMarkup(<GeminiKeySettings />);
  expect(html).toContain('aria-label="Gemini key management"');
  expect(html).toContain('aria-label="Gemini API key"');
  expect(html).toContain('type="password"');
  expect(html).toContain('autoComplete="off"');
  expect(html).toContain('disabled="">Save</button>');
});
