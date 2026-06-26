import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Base Card ────────────────────────────────────────────────────────────────

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable, ...props }, ref) => {
    if (hoverable) {
      return (
        <motion.div
          ref={ref}
          whileHover={{ y: -4, boxShadow: "0 16px 32px -8px rgba(0,0,0,0.3)" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn("rounded-xl border border-border bg-card/60 backdrop-blur-sm", className)}
          {...(props as HTMLMotionProps<"div">)}
        />
      );
    }
    return (
      <div
        ref={ref}
        className={cn("rounded-xl border border-border bg-card/60 backdrop-blur-sm", className)}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-base font-semibold text-foreground", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

// ─── GlassCard ────────────────────────────────────────────────────────────────

const glassCardVariants = cva(
  // Base: glassmorphism foundation
  "relative rounded-xl border backdrop-blur transition-shadow",
  {
    variants: {
      blur: {
        sm: "backdrop-blur-sm",
        md: "backdrop-blur-md",
        lg: "backdrop-blur-lg",
      },
      opacity: {
        low: "bg-white/5 dark:bg-white/5",
        medium: "bg-white/10 dark:bg-white/10",
        high: "bg-white/20 dark:bg-white/20",
      },
      gradient: {
        true: "border-transparent",   // border hidden — gradient pseudo-element takes over
        false: "border-border/50",
      },
      hoverable: {
        true: "cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      blur: "md",
      opacity: "medium",
      gradient: false,
      hoverable: false,
    },
  }
);

export interface GlassCardProps
  extends Omit<HTMLMotionProps<"div">, keyof VariantProps<typeof glassCardVariants> | "children">,
    VariantProps<typeof glassCardVariants> {
  children?: React.ReactNode;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, blur, opacity, gradient, hoverable, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={
          hoverable
            ? { y: -4, boxShadow: "0 20px 40px -12px rgba(0,0,0,0.35)" }
            : undefined
        }
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn(
          glassCardVariants({ blur, opacity, gradient, hoverable }),
          // Subtle inner highlight
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
          className
        )}
        {...props}
      >
        {/* Gradient border via pseudo-element replacement (inset ring) */}
        {gradient && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              padding: "1px",
              background:
                "linear-gradient(135deg, rgba(20,184,166,0.6), rgba(99,102,241,0.4), rgba(20,184,166,0.2))",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
        )}
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  GlassCard,
  glassCardVariants,
};
