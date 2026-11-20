import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

const origin = "http://localhost:3000";

describe("safeNext", () => {
  it("keeps internal paths with query and hash", () => {
    expect(safeNext("/account", origin)).toBe("/account");
    expect(safeNext("/events/abc?x=1#chat", origin)).toBe("/events/abc?x=1#chat");
    expect(safeNext("/crews/Vml9J7eh", origin)).toBe("/crews/Vml9J7eh");
  });

  it("rejects paths that browsers resolve to another site", () => {
    expect(safeNext("/\\example.com", origin)).toBe("/");
    expect(safeNext("/\\/example.com", origin)).toBe("/");
    expect(safeNext("//example.com", origin)).toBe("/");
    expect(safeNext("/\t/example.com", origin)).toBe("/");
  });

  it("rejects absolute and non-path values", () => {
    expect(safeNext("https://example.com", origin)).toBe("/");
    expect(safeNext("javascript:alert(1)", origin)).toBe("/");
    expect(safeNext("account", origin)).toBe("/");
  });

  it("rejects missing or non-string values", () => {
    expect(safeNext(undefined, origin)).toBe("/");
    expect(safeNext("", origin)).toBe("/");
    expect(safeNext(["/account", "/\\example.com"], origin)).toBe("/");
  });
});
