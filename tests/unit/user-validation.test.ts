import { describe, expect, it } from "bun:test";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  usernameSchema
} from "../../packages/shared/src/index";

describe("usernameSchema", () => {
  it("accepts 'abc-12_x'", () => {
    expect(usernameSchema.safeParse("abc-12_x").success).toBe(true);
  });

  it("rejects 'ab' (too short)", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });

  it("rejects 'bad name' (space)", () => {
    expect(usernameSchema.safeParse("bad name").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it(`accepts passwords of length ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH}`, () => {
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
  });

  it("rejects passwords shorter than 8 or longer than 128", () => {
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });
});
