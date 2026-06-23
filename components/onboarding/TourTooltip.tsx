"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  targetSelector?: string;
  open: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
};

export default function TourTooltip({
  targetSelector,
  open,
  onClose,
  children,
  placement = "bottom",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = targetSelector ? (document.querySelector(targetSelector) as HTMLElement | null) : null;
    const tooltip = ref.current;
    if (!tooltip) return;

    const compute = () => {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      if (!el) {
        // center
        setStyle({
          left: `${(viewportW - tooltip.offsetWidth) / 2}px`,
          top: `${(viewportH - tooltip.offsetHeight) / 2}px`,
        });
        return;
      }
      const rect = el.getBoundingClientRect();
      const margin = 16;
      // simple placement logic with edge flipping
      if (placement === "bottom") {
        let top = rect.bottom + margin + window.scrollY;
        let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + window.scrollX;
        if (top + tooltip.offsetHeight > window.scrollY + viewportH)
          top = rect.top - tooltip.offsetHeight - margin + window.scrollY;
        if (left < 8) left = 8 + window.scrollX;
        if (left + tooltip.offsetWidth > viewportW - 8)
          left = viewportW - tooltip.offsetWidth - 8 + window.scrollX;
        setStyle({ left: `${left}px`, top: `${top}px` });
      } else if (placement === "top") {
        let top = rect.top - tooltip.offsetHeight - margin + window.scrollY;
        let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + window.scrollX;
        if (top < window.scrollY) top = rect.bottom + margin + window.scrollY;
        setStyle({ left: `${left}px`, top: `${top}px` });
      } else if (placement === "left") {
        const left = rect.left - tooltip.offsetWidth - margin + window.scrollX;
        const top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2 + window.scrollY;
        setStyle({ left: `${left}px`, top: `${top}px` });
      } else {
        const left = rect.right + margin + window.scrollX;
        const top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2 + window.scrollY;
        setStyle({ left: `${left}px`, top: `${top}px` });
      }
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, targetSelector, placement]);

  if (!open || !mounted) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        style={style}
        initial={{ opacity: 0, scale: 0.9, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed z-[99999] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4 shadow-2xl backdrop-blur-xl"
      >
        <div className="text-sm text-zinc-100">{children}</div>
      </motion.div>
    </AnimatePresence>
  );
}
