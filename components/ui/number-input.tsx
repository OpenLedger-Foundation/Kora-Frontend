import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  showUSDC?: boolean;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      label,
      error,
      success,
      hint,
      showUSDC = true,
      id,
      onChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const localRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => localRef.current!);

    const triggerChange = () => {
      if (localRef.current) {
        const event = new Event("change", { bubbles: true });
        localRef.current.dispatchEvent(event);
        if (onChange) {
          const changeEvent = {
            target: localRef.current,
            currentTarget: localRef.current,
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(changeEvent);
        }
      }
    };

    const handleIncrement = (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (localRef.current) {
        localRef.current.stepUp();
        triggerChange();
      }
    };

    const handleDecrement = (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (localRef.current) {
        localRef.current.stepDown();
        triggerChange();
      }
    };

    const ariaDescribedBy = [
      error ? errorId : null,
      hint ? hintId : null,
      props["aria-describedby"],
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {showUSDC && (
            <div className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none uppercase tracking-wider">
              USDC
            </div>
          )}
          <input
            id={inputId}
            type="number"
            ref={localRef}
            onChange={onChange}
            disabled={disabled}
            aria-describedby={ariaDescribedBy || undefined}
            aria-invalid={!!error}
            className={cn(
              "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors",
              "border-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              showUSDC && "pl-14",
              "pr-10",
              success && !error && "border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30",
              error && "border-destructive/50 focus:border-destructive focus:ring-destructive/30",
              className
            )}
            {...props}
          />
          <div className="absolute right-1 flex flex-col h-8 justify-between border-l border-zinc-800 pl-1 py-0.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={handleIncrement}
              disabled={disabled}
              className="flex items-center justify-center p-0.5 rounded text-muted-foreground hover:bg-zinc-800 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Increment value"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={handleDecrement}
              disabled={disabled}
              className="flex items-center justify-center p-0.5 rounded text-muted-foreground hover:bg-zinc-800 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Decrement value"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {error && (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
