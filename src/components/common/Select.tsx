import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SelectProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel?: string;
  className?: string;
  placement?: "up" | "down" | "auto";
}

export function Select<T extends string | number = string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  placement = "auto",
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [openUpwards, setOpenUpwards] = useState(placement === "up");

  const currentOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;

    if (placement === "auto" && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 220 && rect.top > 220);
    } else if (placement === "up") {
      setOpenUpwards(true);
    } else {
      setOpenUpwards(false);
    }

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, placement]);

  return (
    <div
      ref={containerRef}
      className={`apple-select-container ${className} ${isOpen ? "open" : ""} ${openUpwards ? "open-up" : "open-down"}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="apple-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="apple-select-value">
          {currentOption?.icon && (
            <span className="apple-select-icon">{currentOption.icon}</span>
          )}
          <span>{currentOption?.label ?? String(value)}</span>
        </span>
        <ChevronDown size={14} className="apple-select-chevron" />
      </button>

      {isOpen && (
        <div
          className="apple-select-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`apple-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span className="option-label">
                  {option.icon && (
                    <span className="option-icon">{option.icon}</span>
                  )}
                  <span>{option.label}</span>
                </span>
                {isSelected && (
                  <Check
                    size={13}
                    className="option-check"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
