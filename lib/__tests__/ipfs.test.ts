import { isValidCID, validateCid, ipfsUrl, InvalidCIDError } from "../ipfs";

describe("IPFS utilities", () => {
  describe("isValidCID", () => {
    it("should return true for valid CIDv0 (Qm...)", () => {
      const validCidv0 = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      expect(isValidCID(validCidv0)).toBe(true);
    });

    it("should return true for valid CIDv1 (bafy...)", () => {
      const validCidv1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      expect(isValidCID(validCidv1)).toBe(true);
    });

    it("should return false for invalid CID format", () => {
      const invalidCids = [
        "invalid-cid",
        "QmShort",
        "bafyShort",
        "http://example.com",
        "",
        " ",
      ];
      invalidCids.forEach((cid) => {
        expect(isValidCID(cid)).toBe(false);
      });
    });
  });

  describe("validateCid", () => {
    it("should not throw for valid CIDs", () => {
      const validCidv0 = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      const validCidv1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      expect(() => validateCid(validCidv0)).not.toThrow();
      expect(() => validateCid(validCidv1)).not.toThrow();
    });

    it("should throw InvalidCIDError for invalid CIDs", () => {
      const invalidCid = "invalid-cid";
      expect(() => validateCid(invalidCid)).toThrow(InvalidCIDError);
    });
  });

  describe("ipfsUrl", () => {
    it("should return a valid gateway URL for valid CIDs", () => {
      const validCid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
      const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";
      expect(ipfsUrl(validCid)).toBe(`${gateway}/${validCid}`);
    });

    it("should throw InvalidCIDError for invalid CIDs", () => {
      const invalidCid = "invalid-cid";
      expect(() => ipfsUrl(invalidCid)).toThrow(InvalidCIDError);
    });
  });
});