import React, { useState } from "react";

export interface PromptDialogData {
  title: string;
  label: string;
  value: string;
  submit: (name: string) => void;
}

export interface PromptModalProps {
  dialog: PromptDialogData;
  onClose: () => void;
}

export function PromptModal({ dialog, onClose }: PromptModalProps) {
  const [value, setValue] = useState(dialog.value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
          dialog.submit(trimmed);
          onClose();
        }
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
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
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
