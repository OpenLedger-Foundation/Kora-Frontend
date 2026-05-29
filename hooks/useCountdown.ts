"use client";

import { useState, useEffect } from "react";

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

/**
 * Hook to track countdown time until a target date.
 * Updates every minute by default.
 * @param targetDate - Target date string (ISO 8601) or Date object
 * @param updateInterval - Update interval in milliseconds (default: 60000 = 1 minute)
 * @returns Countdown object with days, hours, minutes, seconds, and isExpired flag
 */
export function useCountdown(
  targetDate: string | Date | null | undefined,
  updateInterval = 60000
): CountdownTime {
  const [countdown, setCountdown] = useState<CountdownTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
  });

  useEffect(() => {
    if (!targetDate) {
      setCountdown({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
      });
      return;
    }

    const calculateCountdown = () => {
      const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
      const now = new Date();
      const diffMs = target.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setCountdown({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
    };

    // Calculate immediately
    calculateCountdown();

    // Set up interval for updates
    const interval = setInterval(calculateCountdown, updateInterval);

    return () => clearInterval(interval);
  }, [targetDate, updateInterval]);

  return countdown;
}

/**
 * Format countdown as readable string.
 * @param countdown - Countdown object from useCountdown
 * @returns Formatted string like "Expires in 3 days 5 hours"
 */
export function formatCountdown(countdown: CountdownTime): string {
  if (countdown.isExpired) {
    return "Expired";
  }

  const parts = [];
  if (countdown.days > 0) parts.push(`${countdown.days} day${countdown.days !== 1 ? "s" : ""}`);
  if (countdown.hours > 0) parts.push(`${countdown.hours} hour${countdown.hours !== 1 ? "s" : ""}`);
  if (countdown.minutes > 0 && countdown.days === 0) {
    parts.push(`${countdown.minutes} minute${countdown.minutes !== 1 ? "s" : ""}`);
  }

  if (parts.length === 0) {
    return "Expires in less than a minute";
  }

  return `Expires in ${parts.join(" ")}`;
}
