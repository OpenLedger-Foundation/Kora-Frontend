import { describe, it, expect } from "vitest";
import {
  HEALTH_CHECK_PATHS,
  isAutomatedClientUserAgent,
  isAuthProtectedPath,
  isBotChallengeBypassed,
  isHealthCheckPath,
  isUptimeBotUserAgent,
} from "../lib/botChallenge";

describe("bot challenge allowlist (#1228)", () => {
  describe("health endpoints", () => {
    it("recognises every configured health path", () => {
      for (const path of HEALTH_CHECK_PATHS) {
        expect(isHealthCheckPath(path)).toBe(true);
      }
    });

    it("recognises trailing slashes and nested health paths", () => {
      expect(isHealthCheckPath("/api/health/")).toBe(true);
      expect(isHealthCheckPath("/api/health/dependencies")).toBe(true);
    });

    it("does not treat lookalike paths as health endpoints", () => {
      expect(isHealthCheckPath("/marketplace")).toBe(false);
      expect(isHealthCheckPath("/api/health-check-login")).toBe(false);
    });

    it("bypasses health endpoints regardless of user agent", () => {
      expect(
        isBotChallengeBypassed({
          pathname: "/api/health",
          userAgent: "curl/8.0",
        })
      ).toBe(true);
    });
  });

  describe("uptime monitors", () => {
    it("recognises common monitoring user agents", () => {
      const agents = [
        "UptimeRobot/2.0 (https://uptimerobot.com/)",
        "Pingdom.com_bot_version_1.4",
        "Datadog Agent/7",
        "Mozilla/5.0 (compatible; StatusCakeBot/1.0)",
        "NewRelicPinger/1.0",
        "Better Uptime Bot",
        "GrafanaCloud Pingdom",
        "Checkly/1.0",
        "Healthchecks.io/1.0",
      ];
      for (const agent of agents) {
        expect(isUptimeBotUserAgent(agent)).toBe(true);
      }
    });

    it("does not exempt arbitrary user agents", () => {
      expect(isUptimeBotUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
      expect(isUptimeBotUserAgent(null)).toBe(false);
      expect(isUptimeBotUserAgent(undefined)).toBe(false);
    });

    it("exempts monitors on public routes", () => {
      expect(
        isBotChallengeBypassed({
          pathname: "/marketplace",
          userAgent: "UptimeRobot/2.0",
        })
      ).toBe(true);
    });
  });

  describe("automated clients", () => {
    it("detects scripted clients", () => {
      for (const agent of [
        "curl/8.4.0",
        "python-requests/2.31.0",
        "Wget/1.21",
        "Scrapy/2.11",
        "PostmanRuntime/7.36",
      ]) {
        expect(isAutomatedClientUserAgent(agent)).toBe(true);
      }
    });

    it("does not classify browsers as automated clients", () => {
      expect(
        isAutomatedClientUserAgent(
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
        )
      ).toBe(false);
    });
  });

  describe("auth paths are never bypassed", () => {
    it("identifies auth-protected prefixes", () => {
      for (const path of [
        "/api/auth/challenge",
        "/api/auth/verify",
        "/api/invoice",
        "/dashboard/sme",
        "/invoice/create",
        "/settings",
        "/transactions",
        "/analytics",
      ]) {
        expect(isAuthProtectedPath(path)).toBe(true);
      }
    });

    it("refuses a bypass even for an uptime user agent on an auth path", () => {
      expect(
        isBotChallengeBypassed({
          pathname: "/api/auth/challenge",
          userAgent: "UptimeRobot/2.0",
        })
      ).toBe(false);
    });

    it("refuses a bypass even for a health-looking auth subpath", () => {
      expect(
        isBotChallengeBypassed({
          pathname: "/api/auth/health",
          userAgent: "Datadog Agent",
        })
      ).toBe(false);
    });

    it("leaves ordinary public routes unprotected by the bypass", () => {
      expect(
        isBotChallengeBypassed({
          pathname: "/marketplace",
          userAgent: "curl/8.4.0",
        })
      ).toBe(false);
    });
  });
});
