"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  targetSelector?: string;
  open: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
};

export default function TourTooltip({ targetSelector, open, onClose, children, placement = "bottom" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const el = targetSelector ? document.querySelector(targetSelector) as HTMLElement | null : null;
    const tooltip = ref.current;
    if (!tooltip) return;

    const compute = () => {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      if (!el) {
        // center
        setStyle({ left: `${(viewportW - tooltip.offsetWidth) / 2}px`, top: `${(viewportH - tooltip.offsetHeight) / 2}px` });
        return;
      }
      const rect = el.getBoundingClientRect();
      const margin = 12;
      // simple placement logic with edge flipping
      if (placement === "bottom") {
        let top = rect.bottom + margin + window.scrollY;
        let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + window.scrollX;
        if (top + tooltip.offsetHeight > window.scrollY + viewportH) top = rect.top - tooltip.offsetHeight - margin + window.scrollY;
        if (left < 8) left = 8 + window.scrollX;
        if (left + tooltip.offsetWidth > viewportW - 8) left = viewportW - tooltip.offsetWidth - 8 + window.scrollX;
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

  if (!open) return null;

  return (
    <div ref={ref} style={style} className="z-[99999] max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
      <div className="text-sm text-zinc-200">{children}</div>
      <div className="mt-2 flex justify-end">
        <button className="text-xs text-zinc-400" onClick={() => onClose?.()}>Close</button>
      </div>
    </div>
  );
}
