"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Success Checkmark ────────────────────────────────────────────────────────

export function SuccessCheckmark({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 52 52"
      className={cn("h-12 w-12", className)}
      initial="hidden"
      animate="visible"
    >
      {/* Circle */}
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-emerald-500"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: { pathLength: 1, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
        }}
      />
      {/* Tick */}
      <motion.path
        d="M14 27 l8 8 l16 -16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-500"
        variants={{
          hidden: { pathLength: 0 },
          visible: { pathLength: 1, transition: { duration: 0.3, delay: 0.35, ease: "easeOut" } },
        }}
      />
    </motion.svg>
  );
}

// ─── Spinners ─────────────────────────────────────────────────────────────────

/** Circle spinner — default, suits buttons and inline contexts */
export function SpinnerCircle({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 text-current", className)}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-20" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </motion.svg>
  );
}

/** Dots spinner — suits card/section loading states */
export function SpinnerDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Pulse spinner — suits full-page / overlay loading states */
export function SpinnerPulse({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-10 w-10", className)}>
      <motion.span
        className="absolute inset-0 rounded-full bg-primary/40"
        animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
        transition={{ repeat: Infinity, duration: 1, ease: "easeOut" }}
      />
      <span className="absolute inset-[30%] rounded-full bg-primary" />
    </div>
  );
}
