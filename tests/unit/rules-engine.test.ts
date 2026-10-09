import { describe, expect, it } from "bun:test";
import type {
  EvaluableRuleset,
  MessageRuleContext,
  RuleCondition,
} from "../../apps/worker/src/lib/rules-engine";
import { evaluateRulesets } from "../../apps/worker/src/lib/rules-engine";

const CTX: MessageRuleContext = {
  from: "Newsletter <news@example.com>",
  subject: "Weekly newsletter #5",
  rawHeaders:
    "From: Newsletter <news@example.com>\r\nSubject: Weekly newsletter #5\r\nX-Mailer: Outlook\r\nMessage-ID: <abc123@example.com>",
};

function ruleset(overrides: Partial<EvaluableRuleset> = {}): EvaluableRuleset {
  return {
    id: "rs-1",
    priority: 0,
    logic_operator: "AND",
    conditions: [{ field: "subject", match_type: "contains", condition_value: "news" }],
    actions: [{ action_type: "mark_as_read", action_value: null }],
    ...overrides,
  };
}

describe("AND logic", () => {
  it("matches when all conditions are true", () => {
    const rs = ruleset({
      conditions: [
        { field: "from", match_type: "contains", condition_value: "news" },
        {
          field: "subject",
          match_type: "contains",
          condition_value: "newsletter",
        },
      ],
    });
    const d = evaluateRulesets([rs], CTX);
    expect(d.matched).toBe(true);
    expect(d.matched_ruleset_ids).toEqual(["rs-1"]);
  });

  it("does not match when one condition is false", () => {
    const rs = ruleset({
      conditions: [
        { field: "from", match_type: "contains", condition_value: "news" },
        {
          field: "subject",
          match_type: "contains",
          condition_value: "no-such-text",
        },
      ],
    });
    const d = evaluateRulesets([rs], CTX);
    expect(d.matched).toBe(false);
    expect(d.matched_ruleset_ids).toEqual([]);
  });
});

describe("OR logic", () => {
  it("matches when one condition is true", () => {
    const rs = ruleset({
      logic_operator: "OR",
      conditions: [
        {
          field: "subject",
          match_type: "contains",
          condition_value: "no-such-text",
        },
        { field: "from", match_type: "contains", condition_value: "news" },
      ],
    });
    const d = evaluateRulesets([rs], CTX);
    expect(d.matched).toBe(true);
    expect(d.matched_ruleset_ids).toEqual(["rs-1"]);
  });

  it("does not match when all conditions are false", () => {
    const rs = ruleset({
      logic_operator: "OR",
      conditions: [
        {
          field: "subject",
          match_type: "contains",
          condition_value: "no-such-text",
        },
        { field: "from", match_type: "equal", condition_value: "other" },
      ],
    });
    const d = evaluateRulesets([rs], CTX);
    expect(d.matched).toBe(false);
  });
});

describe("match types against from", () => {
  const from = "Newsletter <news@example.com>";
  const ctx: MessageRuleContext = { from, subject: "", rawHeaders: "" };
  const cond = (match_type: RuleCondition["match_type"], condition_value: string) =>
    evaluateRulesets(
      [
        ruleset({
          conditions: [{ field: "from", match_type, condition_value }],
        }),
      ],
      ctx,
    ).matched;

  it("contains: true and false", () => {
    expect(cond("contains", "news@")).toBe(true);
    expect(cond("contains", "zzz")).toBe(false);
  });

  it("not contains: true and false", () => {
    expect(cond("not contains", "zzz")).toBe(true);
    expect(cond("not contains", "news@")).toBe(false);
  });

  it("equal: true and false", () => {
    expect(cond("equal", from)).toBe(true);
    expect(cond("equal", "Newsletter")).toBe(false);
  });

  it("not equal: true and false", () => {
    expect(cond("not equal", "Newsletter")).toBe(true);
    expect(cond("not equal", from)).toBe(false);
  });

  it("start with: true and false", () => {
    expect(cond("start with", "News")).toBe(true);
    expect(cond("start with", "news@example")).toBe(false);
  });

  it("end with: true and false", () => {
    expect(cond("end with", ".com>")).toBe(true);
    expect(cond("end with", "Newsletter")).toBe(false);
  });

  it("match regex: true and false", () => {
    expect(cond("match regex", "news@.*\\.com")).toBe(true);
    expect(cond("match regex", "^zzz")).toBe(false);
  });

  it("match regex: match only beyond the 8KB boundary → non-match", () => {
    const d = evaluateRulesets(
      [
        ruleset({
          conditions: [
            {
              field: "header",
              match_type: "match regex",
              condition_value: "needle",
            },
          ],
        }),
      ],
      { from: "", subject: "", rawHeaders: `${"x".repeat(9000)}needle` },
    );
    expect(d.matched).toBe(false);
  });
});

describe("case sensitivity", () => {
  it("non-regex ops are case-insensitive", () => {
    const d = evaluateRulesets(
      [
        ruleset({
          conditions: [
            {
              field: "subject",
              match_type: "contains",
              condition_value: "Newsletter",
            },
          ],
        }),
      ],
      { from: "", subject: "newsletter #5", rawHeaders: "" },
    );
    expect(d.matched).toBe(true);
  });

  it("regex is case-sensitive by default", () => {
    const mk = (pattern: string) =>
      evaluateRulesets(
        [
          ruleset({
            conditions: [
              {
                field: "subject",
                match_type: "match regex",
                condition_value: pattern,
              },
            ],
          }),
        ],
        { from: "", subject: "newsletter #5", rawHeaders: "" },
      ).matched;
    expect(mk("Newsletter")).toBe(false);
    expect(mk("[Nn]ewsletter")).toBe(true);
  });
});

describe("header field", () => {
  it("contains matches over the full raw header text", () => {
    const d = evaluateRulesets(
      [
        ruleset({
          conditions: [
            {
              field: "header",
              match_type: "contains",
              condition_value: "X-Mailer: Outlook",
            },
          ],
        }),
      ],
      CTX,
    );
    expect(d.matched).toBe(true);
  });

  it("does not match text absent from headers", () => {
    const d = evaluateRulesets(
      [
        ruleset({
          conditions: [
            {
              field: "header",
              match_type: "contains",
              condition_value: "X-Mailer: Thunderbird",
            },
          ],
        }),
      ],
      CTX,
    );
    expect(d.matched).toBe(false);
  });
});

describe("priority ordering and last move wins", () => {
  it("later-priority move wins and ids are in priority order", () => {
    const low = ruleset({
      id: "rs-low",
      priority: 5,
      actions: [{ action_type: "move_to_folder", action_value: "folder-a" }],
    });
    const high = ruleset({
      id: "rs-high",
      priority: 10,
      actions: [{ action_type: "move_to_folder", action_value: "folder-b" }],
    });
    // pass in reverse order to prove the engine sorts by priority
    const d = evaluateRulesets([high, low], CTX);
    expect(d.matched).toBe(true);
    expect(d.folder_id).toBe("folder-b");
    expect(d.matched_ruleset_ids).toEqual(["rs-low", "rs-high"]);
  });

  it("ties break by ruleset id ascending", () => {
    const b = ruleset({
      id: "rs-b",
      priority: 1,
      actions: [{ action_type: "move_to_folder", action_value: "folder-b" }],
    });
    const a = ruleset({
      id: "rs-a",
      priority: 1,
      actions: [{ action_type: "move_to_folder", action_value: "folder-a" }],
    });
    const d = evaluateRulesets([b, a], CTX);
    expect(d.matched_ruleset_ids).toEqual(["rs-a", "rs-b"]);
    expect(d.folder_id).toBe("folder-b");
  });
});

describe("action fold across rulesets", () => {
  it("applies star, read and move from different rulesets; last move wins", () => {
    const d = evaluateRulesets(
      [
        ruleset({
          id: "rs-1",
          priority: 1,
          actions: [
            { action_type: "mark_as_star", action_value: null },
            { action_type: "move_to_folder", action_value: "folder-a" },
          ],
        }),
        ruleset({
          id: "rs-2",
          priority: 2,
          actions: [
            { action_type: "mark_as_read", action_value: null },
            { action_type: "move_to_folder", action_value: "folder-b" },
          ],
        }),
      ],
      CTX,
    );
    expect(d.matched).toBe(true);
    expect(d.is_starred).toBe(true);
    expect(d.is_read).toBe(true);
    expect(d.folder_id).toBe("folder-b");
    expect(d.matched_ruleset_ids).toEqual(["rs-1", "rs-2"]);
  });
});

describe("invalid regex", () => {
  it("is non-matching and never throws", () => {
    expect(() =>
      evaluateRulesets(
        [
          ruleset({
            conditions: [
              {
                field: "subject",
                match_type: "match regex",
                condition_value: "(unclosed",
              },
            ],
          }),
        ],
        CTX,
      ),
    ).not.toThrow();
    const d = evaluateRulesets(
      [
        ruleset({
          conditions: [
            {
              field: "subject",
              match_type: "match regex",
              condition_value: "(unclosed",
            },
          ],
        }),
      ],
      CTX,
    );
    expect(d.matched).toBe(false);
  });
});

describe("failed move actions are skipped", () => {
  it("null/empty/whitespace move is skipped and later actions still run", () => {
    for (const bad of [null, "", "   "]) {
      const d = evaluateRulesets(
        [
          ruleset({
            actions: [
              { action_type: "move_to_folder", action_value: bad },
              { action_type: "mark_as_star", action_value: null },
              { action_type: "move_to_folder", action_value: "folder-ok" },
            ],
          }),
        ],
        CTX,
      );
      expect(d.matched).toBe(true);
      expect(d.folder_id).toBe("folder-ok");
      expect(d.is_starred).toBe(true);
    }
  });

  it("a ruleset with only a failed move still counts as matched", () => {
    const d = evaluateRulesets(
      [
        ruleset({
          actions: [{ action_type: "move_to_folder", action_value: "" }],
        }),
      ],
      CTX,
    );
    expect(d.matched).toBe(true);
    expect(d.matched_ruleset_ids).toEqual(["rs-1"]);
    expect(d.folder_id).toBe(null);
  });
});

describe("empty inputs", () => {
  it("no rulesets → unmatched with nulls", () => {
    const d = evaluateRulesets([], CTX);
    expect(d).toEqual({
      matched: false,
      folder_id: null,
      is_starred: false,
      is_read: false,
      matched_ruleset_ids: [],
    });
  });

  it("no matches → unmatched with nulls", () => {
    const d = evaluateRulesets(
      [
        ruleset({
          conditions: [
            {
              field: "subject",
              match_type: "contains",
              condition_value: "no-such-text",
            },
          ],
        }),
      ],
      CTX,
    );
    expect(d.matched).toBe(false);
    expect(d.folder_id).toBe(null);
    expect(d.is_starred).toBe(false);
    expect(d.is_read).toBe(false);
  });

  it("empty conditions → skipped entirely; empty actions → matched but no-op", () => {
    const d = evaluateRulesets(
      [
        ruleset({ id: "rs-empty-cond", conditions: [] }),
        ruleset({ id: "rs-empty-act", actions: [] }),
      ],
      CTX,
    );
    expect(d.matched).toBe(true);
    expect(d.matched_ruleset_ids).toEqual(["rs-empty-act"]);
    expect(d.folder_id).toBe(null);
  });
});
