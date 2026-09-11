import { describe, expect, it } from "bun:test";
import { badRequest, notFound } from "../../apps/worker/src/lib/http-error";
import { API_ERROR_CODES } from "../../packages/shared/src/contracts/errors";

describe("badRequest", () => {
  it("returns a VALIDATION_ERROR envelope with the fixed message and details", () => {
    const details = { username: "too short" };
    expect(badRequest(details)).toEqual({
      error: {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        details,
        message: "Validasi gagal"
      }
    });
  });

  it("passes the details object through by reference", () => {
    const details = { field: "reason" };
    const result = badRequest(details);
    expect(result.error.details).toBe(details);
  });

  it("preserves an empty details object", () => {
    expect(badRequest({})).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: {},
        message: "Validasi gagal"
      }
    });
  });
});

describe("notFound", () => {
  it("returns a NOT_FOUND envelope with the given message", () => {
    expect(notFound("Mailbox tidak ditemukan")).toEqual({
      error: {
        code: API_ERROR_CODES.NOT_FOUND,
        message: "Mailbox tidak ditemukan"
      }
    });
  });

  it("does not include a details key", () => {
    expect("details" in notFound("x").error).toBe(false);
  });

  it("preserves distinct messages verbatim", () => {
    expect(notFound("a").error.message).toBe("a");
    expect(notFound("b").error.message).toBe("b");
  });
});
