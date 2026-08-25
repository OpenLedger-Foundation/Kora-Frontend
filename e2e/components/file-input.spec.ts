/**
 * Component tests — FileInput
 *
 * These tests exercise browser-specific interactions that cannot be reliably
 * reproduced in jsdom.  react-dropzone uses native DataTransfer and
 * URL.createObjectURL, both of which require a real browser context.
 *
 * They run against the isolated fixture page at /test-components
 * (app/test-components/page.tsx), which mounts FileInput in a clean state
 * with no surrounding form logic.
 *
 * Do NOT duplicate any Vitest / jsdom tests.  This file covers:
 *  - Drop zone renders with correct placeholder copy
 *  - The hidden file <input> only accepts application/pdf
 *  - Selecting a valid PDF: name shown, size shown, prompt hidden, remove button shown
 *  - Remove button: clears selection and restores empty state
 *  - Selecting a non-PDF: "Only PDF files are accepted" error appears
 *  - Selecting an oversized PDF: "File is too large" error appears
 *  - dragenter / dragover: isDragActive highlight class applied to drop zone
 *  - Programmatic drop of a valid PDF: file name shown
 *  - Programmatic drop of a non-PDF: type-error message shown
 */

import { test, expect, type Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function gotoFixture(page: Page) {
  await page.goto("/test-components");
  // Wait for the FileInput section to be mounted
  await expect(page.locator("#file-input-fixture")).toBeVisible();
}

/** The dashed drop zone div */
const getDropzone = (page: Page) =>
  page.locator("#file-input-fixture [class*='border-dashed']").first();

/** The hidden <input type="file"> inside the dropzone */
const getFileInput = (page: Page) =>
  page.locator('#file-input-fixture input[type="file"]').first();

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("FileInput component — browser interactions", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test("renders the drop zone with correct placeholder copy", async ({
    page,
  }) => {
    await expect(
      page.getByText(/Drag & drop your invoice PDF here/i)
    ).toBeVisible();
    await expect(page.getByText(/Only PDF up to/i)).toBeVisible();
  });

  test("renders browse link inside the drop zone", async ({ page }) => {
    await expect(
      page.locator("#file-input-fixture").getByText(/browse/i)
    ).toBeVisible();
  });

  test("file input only accepts PDF files", async ({ page }) => {
    const accept = await getFileInput(page).getAttribute("accept");
    expect(accept).toContain("pdf");
  });

  // ── Successful file selection ──────────────────────────────────────────────

  test("selecting a valid PDF shows the file name", async ({ page }) => {
    await getFileInput(page).setInputFiles({
      name: "invoice-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test content"),
    });

    await expect(page.getByText("invoice-test.pdf")).toBeVisible();
  });

  test("selecting a valid PDF shows the file size", async ({ page }) => {
    await getFileInput(page).setInputFiles({
      name: "invoice-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test content"),
    });

    // FileInput calls formatBytes which returns e.g. "21 Bytes", "2.5 KB" etc.
    await expect(page.getByText(/\d+(\.\d+)?\s*(bytes|kb|mb)/i)).toBeVisible();
  });

  test("selecting a valid PDF hides the empty-state prompt", async ({
    page,
  }) => {
    await getFileInput(page).setInputFiles({
      name: "invoice-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });

    await expect(
      page.getByText(/Drag & drop your invoice PDF here/i)
    ).not.toBeVisible();
  });

  test("selecting a valid PDF shows the remove button", async ({ page }) => {
    await getFileInput(page).setInputFiles({
      name: "invoice-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });

    await expect(
      page
        .locator("#file-input-fixture")
        .getByRole("button", { name: /remove file/i })
    ).toBeVisible();
  });

  // ── Remove file ───────────────────────────────────────────────────────────

  test("clicking the remove button clears the file selection", async ({
    page,
  }) => {
    await getFileInput(page).setInputFiles({
      name: "invoice-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });
    await expect(page.getByText("invoice-test.pdf")).toBeVisible();

    await page
      .locator("#file-input-fixture")
      .getByRole("button", { name: /remove file/i })
      .click();

    await expect(
      page.getByText(/Drag & drop your invoice PDF here/i)
    ).toBeVisible();
  });

  test("clicking the remove button hides the file name", async ({ page }) => {
    await getFileInput(page).setInputFiles({
      name: "invoice-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });

    await page
      .locator("#file-input-fixture")
      .getByRole("button", { name: /remove file/i })
      .click();

    await expect(page.getByText("invoice-test.pdf")).not.toBeVisible();
  });

  // ── Validation errors ─────────────────────────────────────────────────────

  test("selecting a non-PDF file shows 'Only PDF files' error", async ({
    page,
  }) => {
    await getFileInput(page).setInputFiles({
      name: "document.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("PK fake docx"),
    });

    await expect(page.getByText(/only pdf files are accepted/i)).toBeVisible();
  });

  test("selecting an oversized PDF shows a size-limit error", async ({
    page,
  }) => {
    // 6 MB — over the 5 MB limit configured in FileInputFixture
    const oversized = Buffer.alloc(6 * 1024 * 1024, 0);
    await getFileInput(page).setInputFiles({
      name: "too-big.pdf",
      mimeType: "application/pdf",
      buffer: oversized,
    });

    await expect(page.getByText(/file is too large/i)).toBeVisible();
  });

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  test("dragenter + dragover applies the active-highlight to the drop zone", async ({
    page,
  }) => {
    const dropzone = getDropzone(page);

    // Fire synthetic DragEvents with a PDF DataTransfer into the dropzone
    await page.evaluate(() => {
      const zone = document.querySelector<HTMLElement>(
        "#file-input-fixture [class*='border-dashed']"
      );
      if (!zone) return;

      const dt = new DataTransfer();
      dt.items.add(
        new File(["content"], "test.pdf", { type: "application/pdf" })
      );

      zone.dispatchEvent(
        new DragEvent("dragenter", { bubbles: true, dataTransfer: dt })
      );
      zone.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        })
      );
    });

    // react-dropzone sets isDragActive → adds border-primary / bg-primary/5
    await expect(dropzone).toHaveClass(/border-primary|bg-primary/);
  });

  test("dropping a valid PDF onto the drop zone shows the file name", async ({
    page,
  }) => {
    const dropzone = getDropzone(page);

    await dropzone.dispatchEvent("drop", {
      dataTransfer: {
        files: [
          {
            name: "dropped-invoice.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("%PDF-1.4 dropped"),
          },
        ],
      },
    });

    await expect(page.getByText("dropped-invoice.pdf")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("dropping a non-PDF file onto the drop zone shows a type error", async ({
    page,
  }) => {
    const dropzone = getDropzone(page);

    await dropzone.dispatchEvent("drop", {
      dataTransfer: {
        files: [
          {
            name: "spreadsheet.xlsx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            buffer: Buffer.from("PK fake xlsx"),
          },
        ],
      },
    });

    await expect(page.getByText(/only pdf files are accepted/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
