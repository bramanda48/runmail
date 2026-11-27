import { describe, expect, it } from "bun:test";
import {
  badRequest,
  errorCodeForStatus,
  fail,
  notFound,
  ok,
} from "../../apps/worker/src/lib/response";
import type { ApiError, ApiSuccess } from "../../packages/shared/src/contracts/envelope";
import { API_ERROR_CODES } from "../../packages/shared/src/contracts/errors";

type Ctx = Parameters<typeof ok>[0];
type Envelope = ApiSuccess<unknown> | ApiError;

interface Captured {
  body: Envelope;
  status: number;
}

/**
 * Stands in for Hono's `c.json`: records the envelope and status each helper emits.
 * `hono` is not installed at the workspace root, so the real Context is stubbed.
 */
function capture(handler: (c: Ctx) => unknown): Captured {
  let captured: Captured | undefined;
  const c = {
    json(body: Envelope, status: number) {
      captured = { body, status };
      return new Response(JSON.stringify(body), { status });
    },
  } as unknown as Ctx;

  handler(c);
  if (!captured) throw new Error("helper never called c.json");
  return captured;
}

function errorOf(envelope: Envelope): ApiError["error"] {
  if (!("error" in envelope)) throw new Error("expected an error envelope");
  return envelope.error;
}

describe("ok", () => {
  it("wraps data in the success envelope at 200 by default", () => {
    const { body, status } = capture((c) => ok(c, { id: "m1" }));
    expect(status).toBe(200);
    expect(body).toEqual({ data: { id: "m1" } });
  });

  it("omits the meta key when no meta is given", () => {
    const { body } = capture((c) => ok(c, { id: "m1" }));
    expect("meta" in body).toBe(false);
  });

  it("attaches meta as a sibling of data", () => {
    const { body } = capture((c) => ok(c, [{ id: "m1" }], { next_cursor: "abc", has_more: true }));
    expect(body).toEqual({
      data: [{ id: "m1" }],
      meta: { next_cursor: "abc", has_more: true },
    });
  });

  it("honours an explicit 201 status", () => {
    const { body, status } = capture((c) => ok(c, { id: "u1" }, undefined, 201));
    expect(status).toBe(201);
    expect(body).toEqual({ data: { id: "u1" } });
  });
});

describe("fail", () => {
  it("renders the error envelope with the given code, message and status", () => {
    const { body, status } = capture((c) =>
      fail(c, API_ERROR_CODES.FORBIDDEN, "Admin role required", 403),
    );
    expect(status).toBe(403);
    expect(body).toEqual({
      error: { code: API_ERROR_CODES.FORBIDDEN, message: "Admin role required" },
    });
  });

  it("omits the details key when details are absent", () => {
    const { body } = capture((c) => fail(c, API_ERROR_CODES.FORBIDDEN, "Nope", 403));
    expect("details" in errorOf(body)).toBe(false);
  });

  it("passes details through unchanged", () => {
    const details = { field: "zone_id" };
    const { body, status } = capture((c) =>
      fail(c, API_ERROR_CODES.DOMAIN_ALREADY_EXISTS, "Domain sudah ada", 409, details),
    );
    expect(status).toBe(409);
    expect(errorOf(body).details).toBe(details);
  });
});

describe("badRequest", () => {
  it("returns a 400 VALIDATION_ERROR envelope with the fixed message", () => {
    const { body, status } = capture((c) => badRequest(c, { username: ["too short"] }));
    expect(status).toBe(400);
    expect(body).toEqual({
      error: {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: "Validasi gagal",
        details: { username: ["too short"] },
      },
    });
  });

  it("preserves an empty details object", () => {
    const { body } = capture((c) => badRequest(c, {}));
    expect(body).toEqual({
      error: {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: "Validasi gagal",
        details: {},
      },
    });
  });
});

describe("notFound", () => {
  it("returns a 404 NOT_FOUND envelope with the given message", () => {
    const { body, status } = capture((c) => notFound(c, "Mailbox tidak ditemukan"));
    expect(status).toBe(404);
    expect(body).toEqual({
      error: { code: API_ERROR_CODES.NOT_FOUND, message: "Mailbox tidak ditemukan" },
    });
  });

  it("does not include a details key", () => {
    const { body } = capture((c) => notFound(c, "x"));
    expect("details" in errorOf(body)).toBe(false);
  });

  it("preserves distinct messages verbatim", () => {
    expect(errorOf(capture((c) => notFound(c, "a")).body).message).toBe("a");
    expect(errorOf(capture((c) => notFound(c, "b")).body).message).toBe("b");
  });
});

describe("errorCodeForStatus", () => {
  it("maps the known client statuses", () => {
    expect(errorCodeForStatus(400)).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    expect(errorCodeForStatus(401)).toBe(API_ERROR_CODES.UNAUTHORIZED);
    expect(errorCodeForStatus(403)).toBe(API_ERROR_CODES.FORBIDDEN);
    expect(errorCodeForStatus(404)).toBe(API_ERROR_CODES.NOT_FOUND);
    expect(errorCodeForStatus(429)).toBe(API_ERROR_CODES.RATE_LIMITED);
  });

  it("maps any 5xx to INTERNAL_ERROR", () => {
    expect(errorCodeForStatus(500)).toBe(API_ERROR_CODES.INTERNAL_ERROR);
    expect(errorCodeForStatus(503)).toBe(API_ERROR_CODES.INTERNAL_ERROR);
  });

  it("falls back to VALIDATION_ERROR for unmapped statuses", () => {
    expect(errorCodeForStatus(418)).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });
});
