import { describe, expect, it } from "bun:test";
import { retentionDaysFromEnv } from "../../apps/worker/src/modules/retention";

describe("retentionDaysFromEnv", () => {
  it("undefined → 30", () => {
    expect(retentionDaysFromEnv(undefined)).toBe(30);
  });

  it('"30" → 30', () => {
    expect(retentionDaysFromEnv("30")).toBe(30);
  });

  it('"7" → 7', () => {
    expect(retentionDaysFromEnv("7")).toBe(7);
  });

  it('"abc" → 30', () => {
    expect(retentionDaysFromEnv("abc")).toBe(30);
  });

  it('"0" → 30', () => {
    expect(retentionDaysFromEnv("0")).toBe(30);
  });

  it('"-5" → 30', () => {
    expect(retentionDaysFromEnv("-5")).toBe(30);
  });
});
