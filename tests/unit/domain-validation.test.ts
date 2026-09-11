import { describe, expect, it } from "bun:test";
import { domainNameSchema } from "../../packages/shared/src/index";

describe("domainNameSchema", () => {
  it("accepts 'Example.COM' and lowercases to 'example.com'", () => {
    const parsed = domainNameSchema.safeParse("Example.COM");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("example.com");
  });

  it("accepts 'a-b.example.co.uk'", () => {
    expect(domainNameSchema.safeParse("a-b.example.co.uk").success).toBe(true);
  });

  it("rejects 'bad' (no dot)", () => {
    expect(domainNameSchema.safeParse("bad").success).toBe(false);
  });

  it("rejects '-bad.com' (label hyphen)", () => {
    expect(domainNameSchema.safeParse("-bad.com").success).toBe(false);
  });

  it("rejects label longer than 63 chars", () => {
    expect(domainNameSchema.safeParse(`${"a".repeat(64)}.com`).success).toBe(false);
  });

  it("rejects '' (empty)", () => {
    expect(domainNameSchema.safeParse("").success).toBe(false);
  });
});
