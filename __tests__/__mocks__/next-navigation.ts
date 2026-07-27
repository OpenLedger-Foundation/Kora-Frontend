/**
 * Minimal stub for next/navigation used in vitest.
 * Individual test files override these with vi.mock("next/navigation", ...).
 */
import { vi } from "vitest";

export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
}));

export const useSearchParams = vi.fn(() => new URLSearchParams());
export const usePathname = vi.fn(() => "/");
export const useParams = vi.fn(() => ({}));
export const notFound = vi.fn(() => { throw new Error("Not found"); });
export const redirect = vi.fn();
