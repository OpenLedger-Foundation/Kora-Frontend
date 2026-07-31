"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { useSettingsStore } from "@/store/settingsStore";
import type { Invoice } from "@/types/invoice";

const REMINDER_STORAGE_KEY = "kora-funding-reminders";

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

export function useFundingReminder(invoices: Invoice[]) {
  const { notifications } = useSettingsStore();
  const toast = useToast();

  useEffect(() => {
    if (!notifications.fundingAlerts) {
      toast.dismiss("fundingAlert");
      return;
    }
    if (invoices.length === 0) return;

    invoices.forEach((invoice) => {
      const isFullyFunded = invoice.status === "fully_funded" || invoice.funding.fundingProgress >= 1;
      if (!isFullyFunded) return;

      const reminderKey = `${invoice.id}:fully_funded`;
      if (getReminderKeys().includes(reminderKey)) return;

      toast.success(
        `Funding alert: Invoice ${invoice.metadata.invoiceNumber} is fully funded!`,
        undefined,
        "fundingAlert",
        "invoiceFunded"
      );
      markReminderShown(reminderKey);
    });
  }, [invoices, notifications.fundingAlerts, toast]);
}
