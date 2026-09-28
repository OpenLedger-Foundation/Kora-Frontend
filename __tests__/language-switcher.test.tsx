/**
 * LanguageSwitcher — component tests (Issue #825).
 *
 * Exercises the dropdown contract end-to-end against the real LocaleProvider
 * and the real message catalogs (no mocked hooks), so a locale change is
 * verified through the same path the app uses: context state, the
 * kora-locale cookie, and the <html lang>/<html dir> attributes.
 *
 * Covers:
 *  a) Toggle open/closed via the trigger button
 *  b) Escape closes an open dropdown
 *  c) Outside mousedown closes an open dropdown
 *  d) Selecting a locale changes the active locale, persists the cookie,
 *     updates <html lang>, and closes the dropdown
 *  e) Selecting an RTL locale (ar) flips <html dir> to rtl
 */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { locales, localeNames, type Locale } from "@/i18n/config";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import ar from "@/messages/ar.json";
import ptBR from "@/messages/pt-BR.json";

const ALL_MESSAGES: Record<Locale, Record<string, unknown>> = {
  en,
  es,
  ar,
  "pt-BR": ptBR,
} as Record<Locale, Record<string, unknown>>;

/** The trigger's aria-label is the localized "language.label" message. */
function labelFor(locale: Locale): string {
  return (ALL_MESSAGES[locale] as { language: { label: string } }).language.label;
}

function renderSwitcher(initialLocale: Locale = "en") {
  return render(
    <LocaleProvider allMessages={ALL_MESSAGES} initialLocale={initialLocale}>
      <LanguageSwitcher />
    </LocaleProvider>
  );
}

/** Same as renderSwitcher, but with a sibling element outside the switcher. */
function renderSwitcherWithOutside(initialLocale: Locale = "en") {
  return render(
    <LocaleProvider allMessages={ALL_MESSAGES} initialLocale={initialLocale}>
      <LanguageSwitcher />
      <button type="button">outside</button>
    </LocaleProvider>
  );
}

async function openDropdown(
  user: ReturnType<typeof userEvent.setup>,
  label: string = labelFor("en")
) {
  await user.click(screen.getByRole("button", { name: label }));
  return screen.getByRole("listbox", { name: label });
}

beforeEach(() => {
  // The provider skips cookie reconciliation when initialLocale is set, but
  // a cookie written by an earlier test would still leak into assertions.
  document.cookie = "kora-locale=; max-age=0";
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});

describe("LanguageSwitcher — rendering", () => {
  it("renders closed with an accessible trigger", () => {
    renderSwitcher();

    const trigger = screen.getByRole("button", { name: "Language" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens on click and lists every locale", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByRole("button", { name: "Language" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const listbox = screen.getByRole("listbox", { name: "Language" });
    for (const loc of locales) {
      expect(
        screen.getByRole("option", { name: localeNames[loc] })
      ).toBeInTheDocument();
      expect(listbox).toContainElement(
        screen.getByRole("option", { name: localeNames[loc] })
      );
    }
  });

  it("marks the active locale as selected and checks it", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openDropdown(user);

    const english = screen.getByRole("option", { name: "English" });
    expect(english).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Español" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    // The check icon is aria-hidden, so the option name stays clean.
    expect(english.textContent).toBe("English");
  });

  it("closes when the trigger is clicked again", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    const trigger = screen.getByRole("button", { name: "Language" });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("LanguageSwitcher — Escape close", () => {
  it("closes an open dropdown on Escape", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openDropdown(user);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Language" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("ignores other keys while open", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openDropdown(user);
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

describe("LanguageSwitcher — outside-click close", () => {
  it("closes an open dropdown on mousedown outside the switcher", async () => {
    const user = userEvent.setup();
    renderSwitcherWithOutside();

    await openDropdown(user);
    await user.click(screen.getByRole("button", { name: "outside" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not close on mousedown inside the switcher", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openDropdown(user);
    // mousedown (not click) on the trigger: the outside-click handler must
    // ignore it, and no click toggle fires to close the dropdown either.
    fireEvent.mouseDown(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("does nothing when closed (no listener side effects)", () => {
    renderSwitcherWithOutside();

    // Neither Escape nor outside mousedown should throw or change state.
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("button", { name: "outside" }));

    expect(screen.getByRole("button", { name: "Language" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});

describe("LanguageSwitcher — locale change", () => {
  it("switches locale, persists the cookie, and closes the dropdown", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openDropdown(user);
    await user.click(screen.getByRole("option", { name: "Español" }));

    // Dropdown closes and the trigger reflects the new locale.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Idioma" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    // LocaleProvider stamped <html> and wrote the cookie.
    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.cookie).toContain("kora-locale=es");

    // The trigger shows the new locale code.
    expect(screen.getByText("es")).toBeInTheDocument();
  });

  it("moves aria-selected to the newly selected locale", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openDropdown(user);
    await user.click(screen.getByRole("option", { name: "Español" }));

    await openDropdown(user, labelFor("es"));
    expect(screen.getByRole("option", { name: "Español" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("option", { name: "English" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("re-translates the trigger label after switching", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    // en → es → ar: each switch re-renders the aria-label from the new catalog.
    await openDropdown(user);
    await user.click(screen.getByRole("option", { name: "Español" }));
    expect(screen.getByRole("button", { name: "Idioma" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Idioma" }));
    await user.click(screen.getByRole("option", { name: "العربية" }));
    expect(screen.getByRole("button", { name: "اللغة" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ar");
  });

  it("keeps the current locale when it is re-selected", async () => {
    const user = userEvent.setup();
    renderSwitcher("pt-BR");

    expect(screen.getByRole("button", { name: "Idioma" })).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Idioma" });
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Português (BR)" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(document.cookie).toContain("kora-locale=pt-BR");

    await user.click(screen.getByRole("button", { name: "Idioma" }));
    expect(screen.getByRole("option", { name: "Português (BR)" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("flips <html dir> to rtl for Arabic and back to ltr for English", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openDropdown(user);
    await user.click(screen.getByRole("option", { name: "العربية" }));
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");

    await user.click(screen.getByRole("button", { name: "اللغة" }));
    await user.click(screen.getByRole("option", { name: "English" }));
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
  });
});
