import React from "react";
import type { LyricDocument } from "../../domain/types";

export interface LineAlignmentVariant {
  doc: LyricDocument;
  kind: "romanisation" | "translation";
  trackId: string;
  original: LyricDocument;
}

export interface LineAlignmentModalProps {
  variant: LineAlignmentVariant;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LineAlignmentModal({
  variant,
  onCancel,
  onConfirm,
}: LineAlignmentModalProps) {
  return (
    <div>
      <p className="eyebrow">SUPPLIED TEXT · LOCAL ONLY</p>
      <h2>Confirm line alignment</h2>
      <p>
        Check that each supplied row belongs to the original line beside
        it. This preserves the original timestamps and line IDs.
      </p>
      <div className="variant-preview">
        {variant.original.lines.map((l, i) => (
          <div key={l.id}>
            <span dir="auto">{l.text}</span>
            <span dir="auto">{variant.doc.lines[i]?.text}</span>
          </div>
        ))}
      </div>
      <div className="dialog-actions">
        <button className="subtle" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={onConfirm}>
          Confirm matching lines
        </button>
      </div>
    </div>
  );
}
