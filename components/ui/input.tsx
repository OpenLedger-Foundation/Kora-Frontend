import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showCharacterCount?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      success,
      hint,
      leftIcon,
      rightIcon,
      showCharacterCount,
      id,
      onChange,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const [valueLength, setValueLength] = React.useState(0);

    React.useEffect(() => {
      if (value !== undefined) {
        setValueLength(String(value).length);
      } else if (defaultValue !== undefined) {
        setValueLength(String(defaultValue).length);
      }
    }, [value, defaultValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValueLength(e.target.value.length);
      if (onChange) {
        onChange(e);
      }
    };

    const [focused, setFocused] = React.useState(false);

    const ariaDescribedBy = [
      error ? errorId : null,
      hint ? hintId : null,
      props["aria-describedby"],
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {(label || (showCharacterCount && props.maxLength)) && (
          <div className="flex items-center justify-between">
            {label && (
              <label htmlFor={inputId} className="text-sm font-medium text-foreground">
                {label}
              </label>
            )}
            {showCharacterCount && props.maxLength && (
              <span className="text-xs text-muted-foreground">
                {valueLength} / {props.maxLength}
              </span>
            )}
          </div>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <motion.div
            animate={focused ? { scale: 1.005 } : { scale: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
          <input
            id={inputId}
            ref={ref}
            onChange={handleChange}
            value={value}
            defaultValue={defaultValue}
            aria-describedby={ariaDescribedBy || undefined}
            aria-invalid={!!error}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
            className={cn(
              "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground",
              "border-input transition-colors",
              "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              success && !error && "border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30",
              error && "border-destructive/50 focus:border-destructive focus:ring-destructive/30",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              className
            )}
            {...props}
          />
          </motion.div>
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
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
Input.displayName = "Input";

export { Input };
