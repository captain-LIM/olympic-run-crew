import { describe, expect, it } from "vitest";
import { requestOrigin } from "./origin";

const h = (o: Record<string, string>) => new Headers(o);
const FALLBACK = "http://localhost:3000";

describe("requestOrigin", () => {
  it("uses x-forwarded-host and x-forwarded-proto (Vercel)", () => {
    expect(requestOrigin(h({ "x-forwarded-host": "orc.vercel.app", "x-forwarded-proto": "https", host: "internal:3000" }), FALLBACK)).toBe("https://orc.vercel.app");
  });

  it("uses the host the user actually typed on a LAN", () => {
    expect(requestOrigin(h({ host: "192.168.219.108:3000", "x-forwarded-proto": "http" }), FALLBACK)).toBe("http://192.168.219.108:3000");
  });

  it("takes the first value of comma-separated headers", () => {
    expect(requestOrigin(h({ "x-forwarded-host": "a.example.com, b.internal", "x-forwarded-proto": "https, http" }), FALLBACK)).toBe("https://a.example.com");
  });

  it("supports IPv6 hosts", () => {
    expect(requestOrigin(h({ host: "[::1]:3000" }), FALLBACK)).toBe("http://[::1]:3000");
  });

  it("falls back when the host is missing or contains characters that are not valid in a host", () => {
    expect(requestOrigin(h({}), FALLBACK)).toBe(FALLBACK);
    expect(requestOrigin(h({ host: "evil.com/path" }), FALLBACK)).toBe(FALLBACK);
    expect(requestOrigin(h({ host: "evil.com\\n" }), FALLBACK)).toBe(FALLBACK);
    expect(requestOrigin(h({ host: "user@evil.com" }), FALLBACK)).toBe(FALLBACK);
  });

  it("only allows http or https", () => {
    expect(requestOrigin(h({ host: "a.example.com", "x-forwarded-proto": "javascript" }), FALLBACK)).toBe("http://a.example.com");
  });
});
