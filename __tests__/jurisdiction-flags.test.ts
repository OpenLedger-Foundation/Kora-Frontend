import { describe, it, expect } from "vitest";
import {
  JURISDICTION_FLAGS,
  JURISDICTION_NAMES,
  getJurisdictionFlag,
  getJurisdictionName,
} from "../lib/utils";

// All jurisdictions present in mockData.ts
const MOCK_DATA_JURISDICTIONS = ["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"] as const;

describe("Jurisdiction flags — lib/utils", () => {
  it("flag map covers all jurisdictions present in mockData.ts", () => {
    MOCK_DATA_JURISDICTIONS.forEach((code) => {
      expect(JURISDICTION_FLAGS).toHaveProperty(code);
    });
  });

  it("name map covers all jurisdictions present in mockData.ts", () => {
    MOCK_DATA_JURISDICTIONS.forEach((code) => {
      expect(JURISDICTION_NAMES).toHaveProperty(code);
    });
  });

  it("getJurisdictionFlag returns emoji for known codes", () => {
    expect(getJurisdictionFlag("NG")).toBe("🇳🇬");
    expect(getJurisdictionFlag("KE")).toBe("🇰🇪");
    expect(getJurisdictionFlag("GH")).toBe("🇬🇭");
    expect(getJurisdictionFlag("ZA")).toBe("🇿🇦");
    expect(getJurisdictionFlag("US")).toBe("🇺🇸");
    expect(getJurisdictionFlag("EU")).toBe("🇪🇺");
    expect(getJurisdictionFlag("UK")).toBe("🇬🇧");
    expect(getJurisdictionFlag("OTHER")).toBe("🌐");
  });

  it("getJurisdictionFlag falls back to code for unknown jurisdiction", () => {
    expect(getJurisdictionFlag("XX")).toBe("XX");
  });

  it("getJurisdictionName returns full name for known codes", () => {
    expect(getJurisdictionName("NG")).toBe("Nigeria");
    expect(getJurisdictionName("KE")).toBe("Kenya");
    expect(getJurisdictionName("GH")).toBe("Ghana");
  });

  it("getJurisdictionName falls back to code for unknown jurisdiction", () => {
    expect(getJurisdictionName("XX")).toBe("XX");
  });
});
