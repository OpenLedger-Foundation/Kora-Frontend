import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-token-md hover:opacity-90",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:bg-muted",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        danger:
          "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

function ButtonSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

type LegacyVariant = "default" | "destructive" | "link";
type LegacySize = "default" | "xl" | "icon-sm";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    Omit<VariantProps<typeof buttonVariants>, "variant" | "size"> {
  variant?: VariantProps<typeof buttonVariants>["variant"] | LegacyVariant;
  size?: VariantProps<typeof buttonVariants>["size"] | LegacySize;
  children?: React.ReactNode;
  asChild?: boolean;
  /** @deprecated Use `isLoading` */
  loading?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Accessible label when the button has no visible text (icon-only). */
  iconLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      isLoading: isLoadingProp,
      leftIcon,
      rightIcon,
      iconLabel,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isLoading = isLoadingProp ?? loading ?? false;
    const isDisabled = disabled || isLoading;
    // Use motion.button for native buttons; Slot for asChild (can't animate third-party roots)
    const Comp = asChild ? Slot : (motion.button as unknown as React.ElementType);

    const resolvedVariant =
      variant === "default" || variant === "destructive" || variant === "link"
        ? variant === "destructive"
          ? "danger"
          : variant === "link"
            ? "ghost"
            : "primary"
        : variant;

    const resolvedSize =
      size === "default"
        ? "md"
        : size === "xl"
          ? "lg"
          : size === "icon-sm"
            ? "icon"
            : size;

    const isIconOnly =
      resolvedSize === "icon" ||
      (!children && !leftIcon && !rightIcon && Boolean(iconLabel));

    const content = isLoading ? (
      <>
        <ButtonSpinner />
        <span className="sr-only">Loading</span>
      </>
    ) : (
      <>
        {leftIcon && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children}
        {rightIcon && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </>
    );

    return (
      <Comp
        type={asChild ? undefined : type}
        className={cn(
          buttonVariants({ variant: resolvedVariant, size: resolvedSize, className }),
          isIconOnly && "gap-0"
        )}
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        aria-disabled={isDisabled || undefined}
        aria-label={isIconOnly ? iconLabel : props["aria-label"]}
        {...(!asChild && !isDisabled && {
          whileHover: { y: -1, opacity: 0.92 },
          whileTap: { scale: 0.97 },
          transition: { duration: 0.15, ease: "easeOut" },
        })}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
