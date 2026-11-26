import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Messages = Record<string, any>;

function loadMessages(locale: string): Messages {
    return JSON.parse(
        readFileSync(resolve(process.cwd(), "messages", `${locale}.json`), "utf8"),
    ) as Messages;
}

function get(messages: Messages, path: string): string {
    return path.split(".").reduce((value, key) => value?.[key], messages) as string;
}

describe("requested i18n surfaces", () => {
    const english = loadMessages("en");

    it.each(["es", "pt-BR"])("keeps %s marketplace chrome translated", (locale) => {
        const messages = loadMessages(locale);

        for (const key of [
            "marketplace.sort.ariaLabel",
            "marketplace.exportCsv",
            "marketplace.comparison.selectionHint",
            "marketplace.watchlist.title",
            "offline.reload",
            "installPrompt.description",
        ]) {
            expect(get(messages, key)).toBeTruthy();
            expect(get(messages, key)).not.toBe(get(english, key));
        }
    });

    it.each(["es", "pt-BR"])("localizes invoice and settings chrome in %s", (locale) => {
        const messages = loadMessages(locale);

        for (const key of [
            "createInvoice.steps.details",
            "createInvoice.transaction.failedDescription",
            "createInvoice.upload.ipfsUnavailable.description",
            "settings.notifications.tourSection.step",
            "wallet.accountSettings.identityVerification",
        ]) {
            expect(get(messages, key)).toBeTruthy();
            expect(get(messages, key)).not.toBe(get(english, key));
        }
    });
});
