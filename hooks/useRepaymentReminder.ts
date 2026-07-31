"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { useSettingsStore } from "@/store/settingsStore";
import type { Invoice } from "@/types/invoice";

const REMINDER_STORAGE_KEY = "kora-repayment-reminders";

function getReminderKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markReminderShown(key: string) {
  if (typeof window === "undefined") return;
  const keys = getReminderKeys();
  if (keys.includes(key)) return;
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify([key, ...keys].slice(0, 50)));
}

function isOverdueOrDue(dateStr: string): boolean {
  const now = new Date();
  const target = new Date(dateStr);
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target.getTime() <= now.getTime();
}

export function useRepaymentReminder(invoices: Invoice[]) {
  const { notifications } = useSettingsStore();
  const toast = useToast();

  useEffect(() => {
    if (!notifications.repaymentAlerts) {
      toast.dismiss("repaymentAlert");
      return;
    }
    if (invoices.length === 0) return;

    invoices.forEach((invoice) => {
      const isDue = isOverdueOrDue(invoice.terms.repaymentDate);
      const needsRepayment = ["fully_funded", "active", "partially_funded"].includes(invoice.status);
      if (!isDue || !needsRepayment) return;

      const reminderKey = `${invoice.id}:repayment_due`;
      if (getReminderKeys().includes(reminderKey)) return;

      toast.error(
        `Repayment alert: Invoice ${invoice.metadata.invoiceNumber} is due or overdue for repayment!`,
        undefined,
        undefined,
        "repaymentAlert",
        "yieldAvailable"
      );
      markReminderShown(reminderKey);
    });
  }, [invoices, notifications.repaymentAlerts, toast]);
}
