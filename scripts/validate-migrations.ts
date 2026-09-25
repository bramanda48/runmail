#!/usr/bin/env bun
/**
 * Validasi migrasi Drizzle pada D1 lokal (CI-runnable, non-interactive, idempotent).
 *
 * 1. Terapkan semua migrasi (packages/db/src/migrations) ke D1 lokal di temp dir isolated.
 * 2. Assert semua tabel bisnis yang diharapkan ada.
 * 3. Cek PRAGMA foreign_keys (warning saja bila 0, bukan hard fail).
 *
 * Temp dir dihapus di akhir via try/finally.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WORKER_DIR = join(import.meta.dir, "..", "apps", "worker");

const EXPECTED_TABLES = [
  "domains",
  "folders",
  "mailbox_sync_counters",
  "mailbox_users",
  "mailboxes",
  "message_recipients",
  "messages",
  "refresh_tokens",
  "ruleset_actions",
  "ruleset_conditions",
  "rulesets",
  "sync_events",
  "users",
];

interface SpawnResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

function runWrangler(args: string[], persistDir: string): SpawnResult {
  const proc = Bun.spawnSync(["bun", "x", "wrangler", ...args, "--persist-to", persistDir], {
    cwd: WORKER_DIR,
    env: { ...process.env, CI: "1" },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stderr: proc.stderr.toString(),
    stdout: proc.stdout.toString(),
  };
}

function fail(message: string): void {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/** Kumpulkan semua nilai kolom dari hasil `wrangler d1 execute --json` yang berbentuk array. */
function collectColumnValues(parsed: unknown, column: string): unknown[] {
  const values: unknown[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node !== null && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (column in record) values.push(record[column]);
      for (const value of Object.values(record)) visit(value);
    }
  };
  visit(parsed);
  return values;
}

async function main(): Promise<void> {
  const persistDir = await mkdtemp(join(tmpdir(), "validate-migrations-"));
  console.log(`[validate-migrations] persist dir: ${persistDir}`);
  try {
    console.log("[validate-migrations] 1/3 applying migrations (d1 migrations apply --local) ...");
    const apply = runWrangler(
      ["d1", "migrations", "apply", "runmail-dev", "--local", "--config", "wrangler.jsonc"],
      persistDir,
    );
    console.log(apply.stdout.trim());
    if (apply.exitCode !== 0) {
      console.error(apply.stderr.trim());
      fail(`d1 migrations apply exit code ${apply.exitCode}`);
    }
    console.log("[validate-migrations] migrations applied OK");

    console.log("[validate-migrations] 2/3 listing tables via sqlite_master ...");
    const tables = runWrangler(
      [
        "d1",
        "execute",
        "runmail-dev",
        "--local",
        "--config",
        "wrangler.jsonc",
        "--json",
        "--command",
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      ],
      persistDir,
    );
    if (tables.exitCode !== 0) {
      console.error(tables.stderr.trim());
      fail(`d1 execute (sqlite_master) exit code ${tables.exitCode}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(tables.stdout);
    } catch {
      fail(`could not parse --json output:\n${tables.stdout}`);
    }
    const found = new Set(collectColumnValues(parsed, "name").map(String));
    console.log(`[validate-migrations] tables found: ${[...found].sort().join(", ")}`);
    const missing = EXPECTED_TABLES.filter((t) => !found.has(t));
    if (missing.length > 0) fail(`missing tables: ${missing.join(", ")}`);
    console.log(
      `[validate-migrations] all ${EXPECTED_TABLES.length} expected tables present (${EXPECTED_TABLES.join(", ")})`,
    );

    console.log("[validate-migrations] 3/3 checking PRAGMA foreign_keys ...");
    const pragma = runWrangler(
      [
        "d1",
        "execute",
        "runmail-dev",
        "--local",
        "--config",
        "wrangler.jsonc",
        "--json",
        "--command",
        "PRAGMA foreign_keys",
      ],
      persistDir,
    );
    if (pragma.exitCode !== 0) {
      console.error(pragma.stderr.trim());
      fail(`d1 execute (PRAGMA foreign_keys) exit code ${pragma.exitCode}`);
    }
    let pragmaValue: unknown;
    try {
      pragmaValue = collectColumnValues(JSON.parse(pragma.stdout), "foreign_keys")[0];
    } catch {
      pragmaValue = undefined;
    }
    console.log(`[validate-migrations] PRAGMA foreign_keys = ${String(pragmaValue)}`);
    if (pragmaValue === 1 || pragmaValue === "1") {
      console.log("[validate-migrations] foreign_keys ON confirmed");
    } else {
      console.warn(
        "[validate-migrations] WARN: PRAGMA foreign_keys is not 1 (per-connection setting on D1 local); continuing without hard fail",
      );
    }

    console.log("[validate-migrations] SUCCESS: migrations apply clean, schema verified");
  } finally {
    await rm(persistDir, { force: true, recursive: true });
    console.log("[validate-migrations] cleaned up persist dir");
  }
}

await main();
