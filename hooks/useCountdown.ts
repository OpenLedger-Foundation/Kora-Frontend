"use client";

import { useEffect, useRef, useState } from "react";

type Urgency = "normal" | "warning" | "urgent" | "expired";

function toNumber(d: string | Date | number) {
  if (typeof d === "string") return new Date(d).getTime();
  if (typeof d === "number") return d;
  return d.getTime();
}

export function useCountdown(targetDate: string | Date | number, updateMs = 60_000) {
  const targetTs = toNumber(targetDate);
  const [now, setNow] = useState(() => Date.now());
  const prevHoursRef = useRef<number | null>(null);
  const [announce, setAnnounce] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), updateMs);
    return () => clearInterval(id);
  }, [targetTs, updateMs]);

  const diff = Math.max(0, targetTs - now);
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const isExpired = diff <= 0;

  let urgency: Urgency = "normal";
  if (isExpired) urgency = "expired";
  else if (diff < 24 * 60 * 60 * 1000) urgency = "urgent";
  else if (diff < 3 * 24 * 60 * 60 * 1000) urgency = "warning";

  // Announce once every hour: when minutes === 0, or when expired
  useEffect(() => {
    if (isExpired) {
      setAnnounce("Expired");
      return;
    }
    if (minutes === 0) {
      // only announce when hours changed (avoid repeating every minute when minutes===0 due to timing)
      if (prevHoursRef.current !== hours) {
        prevHoursRef.current = hours;
        const d = days > 0 ? `${days} day${days > 1 ? "s" : ""}` : null;
        const h = `${hours} hour${hours !== 1 ? "s" : ""}`;
        setAnnounce(d ? `${d} and ${h} remaining` : `${h} remaining`);
      }
    }
  }, [minutes, hours, days, isExpired]);

  // Clear announce after a short time so assistive tech doesn't repeat unnecessarily
  useEffect(() => {
    if (!announce) return;
    const t = setTimeout(() => setAnnounce(null), 5000);
    return () => clearTimeout(t);
  }, [announce]);

  return {
    days,
    hours,
    minutes,
    isExpired,
    urgency,
    announce,
  } as const;
}

export default useCountdown;
// Helper to format the countdown into the compact string used across the UI
export function formatCountdown(c: { days: number; hours: number; minutes: number; isExpired: boolean }) {
  if (c.isExpired) return "Expired";
  if (c.days === 0) return "Expires today";
  return `${c.days}d ${c.hours}h ${c.minutes}m`;
}
