import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, hashToken, newSessionToken, normalizeEmail, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("concert2026");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("concert2026", h)).toBe(true);
    expect(await verifyPassword("concert2027", h)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("concert2026")).not.toBe(await hashPassword("concert2026"));
  });

  it("rejects malformed stored values", async () => {
    expect(await verifyPassword("x", "plain-text")).toBe(false);
  });
});

describe("policy & helpers", () => {
  it("enforces length and letter+digit", () => {
    expect(checkPasswordPolicy("short1").ok).toBe(false);
    expect(checkPasswordPolicy("onlyletters").ok).toBe(false);
    expect(checkPasswordPolicy("letters123").ok).toBe(true);
  });

  it("normalizes emails", () => {
    expect(normalizeEmail("  Fan@Example.COM ")).toBe("fan@example.com");
    expect(normalizeEmail("no-at-sign")).toBeNull();
  });

  it("stores only token hashes", () => {
    const t = newSessionToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
});
