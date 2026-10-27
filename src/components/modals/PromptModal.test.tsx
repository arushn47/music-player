import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PromptModal, validatePromptKeyword } from "./PromptModal";

describe("PromptModal component", () => {
  it("renders prompt title, label, and buttons", () => {
    const html = renderToStaticMarkup(
      <PromptModal
        dialog={{
          title: "Delete collection",
          label: "Type DELETE to remove this playlist. Your files stay on disk.",
          value: "",
          submit: () => {},
        }}
        onClose={() => {}}
      />
    );

    expect(html).toContain("Delete collection");
    expect(html).toContain("Type DELETE to remove this playlist");
    expect(html).toContain('placeholder="Type DELETE"');
    expect(html).toContain("Confirm");
    expect(html).toContain("Cancel");
  });

  describe("validatePromptKeyword", () => {
    const deleteLabel = "Type DELETE to remove this playlist. Your files stay on disk.";

    it("rejects invalid input and returns error message", () => {
      const empty = validatePromptKeyword(deleteLabel, "");
      expect(empty.valid).toBe(false);
      expect(empty.error).toBe('Type "DELETE" to confirm.');

      const wrong = validatePromptKeyword(deleteLabel, "wrong_word");
      expect(wrong.valid).toBe(false);
      expect(wrong.error).toBe('Type "DELETE" to confirm.');
      expect(wrong.keyword).toBe("DELETE");

      const partial = validatePromptKeyword(deleteLabel, "DEL");
      expect(partial.valid).toBe(false);
      expect(partial.error).toBe('Type "DELETE" to confirm.');
    });

    it("accepts exact uppercase match", () => {
      const result = validatePromptKeyword(deleteLabel, "DELETE");
      expect(result.valid).toBe(true);
      expect(result.finalValue).toBe("DELETE");
      expect(result.error).toBeUndefined();
    });

    it("accepts case-insensitive lowercase match and normalizes to keyword", () => {
      const result = validatePromptKeyword(deleteLabel, "delete");
      expect(result.valid).toBe(true);
      expect(result.finalValue).toBe("DELETE");
      expect(result.error).toBeUndefined();
    });

    it("ignores confirmation keyword requirements on normal prompts", () => {
      const result = validatePromptKeyword("Playlist name", "My Mix");
      expect(result.valid).toBe(true);
      expect(result.finalValue).toBe("My Mix");
      expect(result.keyword).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });
});
