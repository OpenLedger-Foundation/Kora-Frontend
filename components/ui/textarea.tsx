import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  showCharacterCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      success,
      hint,
      showCharacterCount = true,
      id,
      onChange,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-") || generatedId;
    const errorId = `${textareaId}-error`;
    const hintId = `${textareaId}-hint`;

    const [valueLength, setValueLength] = React.useState(0);
    const localRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(ref, () => localRef.current!);

    React.useEffect(() => {
      if (value !== undefined) {
        setValueLength(String(value).length);
      } else if (defaultValue !== undefined) {
        setValueLength(String(defaultValue).length);
      }
    }, [value, defaultValue]);

    const adjustHeight = React.useCallback(() => {
      const textarea = localRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, []);

    React.useEffect(() => {
      adjustHeight();
    }, [value, defaultValue, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValueLength(e.target.value.length);
      adjustHeight();
      if (onChange) {
        onChange(e);
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
        {(label || (showCharacterCount && props.maxLength)) && (
          <div className="flex items-center justify-between">
            {label && (
              <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
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
          <textarea
            id={textareaId}
            ref={localRef}
            onChange={handleChange}
            value={value}
            defaultValue={defaultValue}
            aria-describedby={ariaDescribedBy || undefined}
            aria-invalid={!!error}
            rows={props.rows || 3}
            className={cn(
              "flex min-h-[80px] w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
              "border-input transition-colors resize-none overflow-hidden",
              "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              success && !error && "border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30",
              error && "border-destructive/50 focus:border-destructive focus:ring-destructive/30",
              className
            )}
            {...props}
          />
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
Textarea.displayName = "Textarea";

export { Textarea };
