import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import messages from "@/messages/en.json";
import { InvoiceTransactionGroup } from "../InvoiceTransactionGroup";

it("toggles the controlled content while preserving the focused button", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InvoiceTransactionGroup invoiceId="42" count={2}><p>Transaction detail</p></InvoiceTransactionGroup>
    </NextIntlClientProvider>,
  );
  const button = screen.getByRole("button", { name: /Invoice 42.*2 transactions/ });
  const content = document.getElementById(button.getAttribute("aria-controls")!);
  button.focus();
  expect(content).toBeVisible();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(button).toHaveFocus();
  expect(content).not.toBeVisible();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(content).toBeVisible();
});
