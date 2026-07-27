/**
 * i18n labels for notification settings UI.
 *
 * Extend this file to add additional locales. Currently ships English only.
 */

export interface NotificationCategoryLabels {
  title: string;
  description: string;
}

export interface NotificationChannelLabels {
  email: string;
  push: string;
  emailAriaLabel: string;
  pushAriaLabel: string;
}

export interface NotificationSettingsLabels {
  pageTitle: string;
  pageDescription: string;
  emailColumn: string;
  pushColumn: string;
  resetButton: string;
  savedToast: string;
  resetToast: string;
  categories: Record<string, NotificationCategoryLabels>;
}

export const notificationLabels: NotificationSettingsLabels = {
  pageTitle: "Notification Settings",
  pageDescription:
    "Choose how and when you receive updates about your invoices and account activity.",
  emailColumn: "Email",
  pushColumn: "Push",
  resetButton: "Reset to defaults",
  savedToast: "Notification preferences saved",
  resetToast: "Notification preferences reset to defaults",
  categories: {
    funding: {
      title: "Funding Updates",
      description:
        "Receive alerts when an invoice you own receives a new funding contribution.",
    },
    maturity: {
      title: "Maturity Reminders",
      description:
        "Get reminders as your invoice approaches its repayment date (30, 14, 7, 3, and 1 day before).",
    },
    repayment: {
      title: "Repayment Notifications",
      description: "Be notified when a repayment has been processed on-chain.",
    },
    marketing: {
      title: "Product & Marketing",
      description:
        "Occasional product updates, feature announcements, and promotional content.",
    },
  },
};
