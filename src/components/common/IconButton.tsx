import { ReactNode } from "react";

export interface IconButtonProps {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className = "",
}: IconButtonProps) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""} ${className}`.trim()}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
}
