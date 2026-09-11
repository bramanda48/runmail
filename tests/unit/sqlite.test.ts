import { describe, expect, it } from "bun:test";
import { isUniqueViolation } from "../../apps/worker/src/lib/sqlite";

describe("isUniqueViolation", () => {
  it("returns true for a UNIQUE constraint failure (D1 message casing)", () => {
    expect(isUniqueViolation(new Error("UNIQUE constraint failed: users.username"))).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isUniqueViolation(new Error("unique constraint failed: mailboxes.id"))).toBe(true);
    expect(isUniqueViolation(new Error("Unique Constraint Failed: folders.id"))).toBe(true);
  });

  it("returns false for other database errors", () => {
    expect(isUniqueViolation(new Error("FOREIGN KEY constraint failed"))).toBe(false);
    expect(isUniqueViolation(new Error("no such table: users"))).toBe(false);
    expect(isUniqueViolation(new Error("database is locked"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isUniqueViolation("UNIQUE constraint failed: users.username")).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it("only inspects the top-level message, not a nested cause", () => {
    const err = new Error("D1_ERROR") as Error & { cause: { message: string } };
    err.cause = { message: "UNIQUE constraint failed: users.username" };
    expect(isUniqueViolation(err)).toBe(false);
  });
});
