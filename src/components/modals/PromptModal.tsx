import { useState } from "react";
import { AlertCircle } from "lucide-react";

export interface PromptDialogData {
  title: string;
  label: string;
  value: string;
  submit: (name: string) => void;
  confirmKeyword?: string;
}

export function validatePromptKeyword(
  label: string,
  value: string,
  confirmKeyword?: string,
): { valid: boolean; keyword?: string; finalValue: string; error?: string } {
  const keyword = confirmKeyword || label.match(/\bType\s+([A-Z]+)\b/)?.[1];
  const trimmed = value.trim();
  if (!keyword) {
    return { valid: Boolean(trimmed), finalValue: trimmed };
  }
  if (!trimmed || trimmed.toUpperCase() !== keyword.toUpperCase()) {
    return {
      valid: false,
      keyword,
      finalValue: trimmed,
      error: `Type "${keyword}" to confirm.`,
    };
  }
  return { valid: true, keyword, finalValue: keyword };
}

export interface PromptModalProps {
  dialog: PromptDialogData;
  onClose: () => void;
}

export function PromptModal({ dialog, onClose }: PromptModalProps) {
  const [value, setValue] = useState(dialog.value);
  const [error, setError] = useState<string | null>(null);

  const keyword =
    dialog.confirmKeyword ||
    dialog.label.match(/\bType\s+([A-Z]+)\b/)?.[1];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const result = validatePromptKeyword(
          dialog.label,
          value,
          dialog.confirmKeyword,
        );
        if (!result.valid) {
          if (result.error) setError(result.error);
          return;
        }

        dialog.submit(result.finalValue);
        onClose();
      }}
    >
      <p className="eyebrow">YOUR COLLECTION</p>
      <h2>{dialog.title}</h2>
      <label>
        {dialog.label}
        <input
          autoFocus
          maxLength={100}
          value={value}
          aria-invalid={Boolean(error)}
          className={error ? "has-error" : ""}
          placeholder={keyword ? `Type ${keyword}` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
      </label>
      {error && (
        <p className="dialog-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="subtle"
          onClick={onClose}
        >
          Cancel
        </button>
        <button className="primary" disabled={!value.trim()}>
          Confirm
        </button>
      </div>
    </form>
  );
}
