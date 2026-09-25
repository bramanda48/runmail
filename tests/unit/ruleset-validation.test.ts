import { describe, expect, it } from "bun:test";
import { rulesetSchema, validateRegexSafe } from "../../packages/shared/src/index";

function baseRuleset(overrides: Record<string, unknown> = {}) {
  return {
    name: "Promo filter",
    priority: 0,
    logic_operator: "AND",
    is_enabled: true,
    conditions: [
      {
        field: "subject",
        match_type: "contains",
        condition_value: "promo",
      },
    ],
    actions: [{ action_type: "mark_as_read", action_value: null }],
    ...overrides,
  };
}

describe("rulesetSchema", () => {
  it("accepts a valid ruleset payload", () => {
    expect(rulesetSchema.safeParse(baseRuleset()).success).toBe(true);
  });

  it("rejects empty conditions array", () => {
    const parsed = rulesetSchema.safeParse(baseRuleset({ conditions: [] }));
    expect(parsed.success).toBe(false);
  });

  it("rejects empty actions array", () => {
    const parsed = rulesetSchema.safeParse(baseRuleset({ actions: [] }));
    expect(parsed.success).toBe(false);
  });

  it("rejects negative priority", () => {
    const parsed = rulesetSchema.safeParse(baseRuleset({ priority: -1 }));
    expect(parsed.success).toBe(false);
  });

  it("rejects name longer than 100 chars", () => {
    const parsed = rulesetSchema.safeParse(baseRuleset({ name: "a".repeat(101) }));
    expect(parsed.success).toBe(false);
  });
});

describe("validateRegexSafe", () => {
  it("accepts '[a-z]+'", () => {
    expect(validateRegexSafe("[a-z]+")).toBe(true);
  });

  it("accepts '^\\d+$'", () => {
    expect(validateRegexSafe("^\\d+$")).toBe(true);
  });

  it("rejects '('", () => {
    expect(validateRegexSafe("(")).toBe(false);
  });

  it("rejects '[unclosed'", () => {
    expect(validateRegexSafe("[unclosed")).toBe(false);
  });
});
