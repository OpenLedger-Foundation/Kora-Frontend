import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "../useCopyToClipboard";

describe("useCopyToClipboard", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies text and reports the copied state", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy("hello");
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(copied).toBe(true);
    expect(result.current.copied).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("reports a rejected clipboard write without marking text as copied", async () => {
    writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    const { result } = renderHook(() => useCopyToClipboard());

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy("hello");
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(copied).toBe(false);
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe("Clipboard unavailable");
  });
});
