/// <reference types="@testing-library/jest-dom" />
/**
 * Tests for StellarTxLink component.
 *
 * Covers:
 *  - Renders transaction link with truncated hash
 *  - Opens link in new tab with correct security attributes (target="_blank", rel="noopener noreferrer")
 *  - Network detection: testnet vs mainnet based on NEXT_PUBLIC_STELLAR_NETWORK
 *  - Returns null when hash is null/undefined
 *  - Validates hash format (64-char hex strings only)
 *  - Rejects mock hashes (prefixed with "mock_")
 *  - Tooltip shows full hash on hover
 *  - Accessibility: aria-label describes the link purpose
 *  - Icon shown by default, can be hidden with showIcon={false}
 *  - Size variants work correctly
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StellarTxLink } from "../stellar-tx-link";

// Mock environment variable
// @ts-expect-error - process.env is available at runtime in tests
const originalEnv = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

describe("StellarTxLink", () => {
  const validTestnetHash = "a".repeat(64); // Valid 64-char hex hash
  const validMainnetHash = "b".repeat(64);

  beforeEach(() => {
    // @ts-expect-error - process.env is available at runtime in tests
    (process.env as any).NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
  });

  afterEach(() => {
    // @ts-expect-error - process.env is available at runtime in tests
    (process.env as any).NEXT_PUBLIC_STELLAR_NETWORK = originalEnv;
  });

  describe("Rendering", () => {
    it("should render link with truncated hash", () => {
      render(<StellarTxLink hash={validTestnetHash} chars={6} />);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent("aaaaaa"); // First 6 chars truncated
    });

    it("should render nothing when hash is null", () => {
      const { container } = render(<StellarTxLink hash={null as any} />);
      expect(container.firstChild).toBeNull();
    });

    it("should render nothing when hash is undefined", () => {
      const { container } = render(<StellarTxLink hash={undefined as any} />);
      expect(container.firstChild).toBeNull();
    });

    it("should render nothing when hash is empty string", () => {
      const { container } = render(<StellarTxLink hash={""} />);
      expect(container.firstChild).toBeNull();
    });

    it("should reject invalid hash format (not 64 hex chars)", () => {
      const { container: shortHashContainer } = render(<StellarTxLink hash={"abc"} />);
      expect(shortHashContainer.firstChild).toBeNull();

      const { container: invalidCharContainer } = render(
        <StellarTxLink hash={"g".repeat(64)} /> // g is not valid hex
      );
      expect(invalidCharContainer.firstChild).toBeNull();

      const { container: mixedCaseContainer } = render(
        <StellarTxLink hash={"aAbBcCdDeEfF0123456789AABBCCDDEEFF0123456789AABBCCDDEEFF0123456789"} />
      );
      // Mixed case should work (hex allows both)
      expect(mixedCaseContainer.querySelector("a")).toBeInTheDocument();
    });

    it("should reject mock hashes", () => {
      const { container } = render(<StellarTxLink hash={"mock_" + "a".repeat(59)} />);
      expect(container.firstChild).toBeNull();
    });

    it("should hide icon when showIcon={false}", () => {
      const { container: withIcon } = render(
        <StellarTxLink hash={validTestnetHash} showIcon={true} />
      );
      expect(withIcon.querySelector("svg")).toBeInTheDocument();

      const { container: withoutIcon } = render(
        <StellarTxLink hash={validTestnetHash} showIcon={false} />
      );
      expect(withoutIcon.querySelector("svg")).not.toBeInTheDocument();
    });
  });

  describe("Network Awareness", () => {
    it("should use testnet URL when NEXT_PUBLIC_STELLAR_NETWORK=testnet", () => {
      // @ts-expect-error - process.env is available at runtime
      (process.env as any).NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
      render(<StellarTxLink hash={validTestnetHash} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/testnet/tx/${validTestnetHash}`
      );
    });

    it("should use mainnet URL when NEXT_PUBLIC_STELLAR_NETWORK=mainnet", () => {
      // @ts-expect-error - process.env is available at runtime
      (process.env as any).NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
      render(<StellarTxLink hash={validMainnetHash} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/public/tx/${validMainnetHash}`
      );
    });

    it("should default to testnet URL for unknown network values", () => {
      // @ts-expect-error - process.env is available at runtime
      (process.env as any).NEXT_PUBLIC_STELLAR_NETWORK = "futurenet";
      render(<StellarTxLink hash={validTestnetHash} />);

      const link = screen.getByRole("link");
      // futurenet is not "mainnet", so should use testnet URL
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/testnet/tx/${validTestnetHash}`
      );
    });
  });

  describe("Security", () => {
    it("should open in new tab (target=_blank)", () => {
      render(<StellarTxLink hash={validTestnetHash} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("should have noopener noreferrer for security", () => {
      render(<StellarTxLink hash={validTestnetHash} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("Accessibility", () => {
    it("should have descriptive aria-label", () => {
      render(<StellarTxLink hash={validTestnetHash} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "aria-label",
        `View transaction ${validTestnetHash} on Stellar Expert`
      );
    });

    it("should have proper role and semantic structure", () => {
      render(<StellarTxLink hash={validTestnetHash} />);

      const link = screen.getByRole("link");
      expect(link.tagName).toBe("A");
    });

    it("should display full hash in tooltip", async () => {
      const user = userEvent.setup();
      render(<StellarTxLink hash={validTestnetHash} />);

      const link = screen.getByRole("link");
      await user.hover(link);

      // Tooltip should show full hash
      const tooltip = screen.getByText(validTestnetHash);
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe("Size Variants", () => {
    it("should apply sm size class", () => {
      render(<StellarTxLink hash={validTestnetHash} size="sm" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("text-xs");
    });

    it("should apply md size class", () => {
      render(<StellarTxLink hash={validTestnetHash} size="md" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("text-sm");
    });

    it("should apply lg size class", () => {
      render(<StellarTxLink hash={validTestnetHash} size="lg" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("text-base");
    });
  });

  describe("Custom Truncation", () => {
    it("should truncate to specified number of chars", () => {
      render(<StellarTxLink hash={validTestnetHash} chars={8} />);
      const link = screen.getByRole("link");
      expect(link).toHaveTextContent("aaaaaaaa"); // 8 chars
    });

    it("should use default 6 char truncation", () => {
      render(<StellarTxLink hash={validTestnetHash} />);
      const link = screen.getByRole("link");
      expect(link).toHaveTextContent("aaaaaa"); // 6 chars default
    });

    it("should handle chars=2", () => {
      render(<StellarTxLink hash={validTestnetHash} chars={2} />);
      const link = screen.getByRole("link");
      expect(link).toHaveTextContent("aa");
    });
  });

  describe("CSS Classes", () => {
    it("should accept custom className", () => {
      render(<StellarTxLink hash={validTestnetHash} className="custom-class" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("custom-class");
    });

    it("should always have hover color transition", () => {
      render(<StellarTxLink hash={validTestnetHash} />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass("hover:text-kora-300");
    });
  });
});
