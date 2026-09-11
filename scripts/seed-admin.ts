#!/usr/bin/env bun
/**
 * Seed SATU user admin awal ke database D1 (idempotent, aman dijalankan ulang).
 *
 * Membuat user dengan role 'admin' bila username belum ada; bila sudah ada,
 * tidak melakukan apa-apa (password yang sudah ada tidak pernah ditimpa).
 *
 * Pemakaian:
 *   bun scripts/seed-admin.ts [--username <nama>] [--password <pw>] [--remote --yes]
 *
 * Mode lokal (default) memakai D1 lokal yang sama dengan `wrangler dev`
 * (state default .wrangler/state di apps/worker). Mode --remote mengubah
 * database produksi dan wajib dikonfirmasi dengan --yes.
 */
import { join } from "node:path";
import { uuidv7 } from "../apps/worker/src/lib/ids";
import { hashPassword } from "../apps/worker/src/modules/auth/helpers";

const WORKER_DIR = join(import.meta.dir, "..", "apps", "worker");
const DB_NAME = "runmail-dev";
const DEFAULT_USERNAME = "runmail-admin";
const USERNAME_RE = /^[A-Za-z0-9\-_.]{6,20}$/;
const PASSWORD_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const GENERATED_PASSWORD_LENGTH = 20;

interface SeedArgs {
  username: string;
  password: string | null;
  remote: boolean;
  yes: boolean;
}

interface SpawnResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

function fail(message: string): void {
  console.error(`[seed:admin] ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): SeedArgs {
  let username = DEFAULT_USERNAME;
  let password: string | null = null;
  let remote = false;
  let yes = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--username") {
      i += 1;
      const value = argv[i];
      if (value === undefined) fail("flag --username membutuhkan nilai");
      username = value;
    } else if (arg === "--password") {
      i += 1;
      const value = argv[i];
      if (value === undefined) fail("flag --password membutuhkan nilai");
      password = value;
    } else if (arg === "--remote") {
      remote = true;
    } else if (arg === "--yes") {
      yes = true;
    } else {
      fail(`argumen tidak dikenal: '${arg}'`);
    }
  }
  return { password, remote, username, yes };
}

/** Hasilkan password acak dari charset A-Za-z0-9. */
function generatePassword(): string {
  const random = crypto.getRandomValues(new Uint8Array(GENERATED_PASSWORD_LENGTH));
  let password = "";
  for (let i = 0; i < random.length; i += 1) {
    password += PASSWORD_CHARSET[random[i] % PASSWORD_CHARSET.length];
  }
  return password;
}

/** Escape untuk literal string SQL (wrangler --command hanya menerima SQL mentah). */
function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function runWrangler(args: string[]): SpawnResult {
  const proc = Bun.spawnSync(["bun", "x", "wrangler", ...args], {
    cwd: WORKER_DIR,
    env: { ...process.env, CI: "1" },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe"
  });
  return {
    exitCode: proc.exitCode,
    stderr: proc.stderr.toString(),
    stdout: proc.stdout.toString()
  };
}

/** Ambil array `results` dari output `wrangler d1 execute --json` (bentuk array). */
function findResults(parsed: unknown): Record<string, unknown>[] {
  const visit = (node: unknown): Record<string, unknown>[] | null => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found !== null) return found;
      }
      return null;
    }
    if (node !== null && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (Array.isArray(record.results)) return record.results as Record<string, unknown>[];
      for (const value of Object.values(record)) {
        const found = visit(value);
        if (found !== null) return found;
      }
    }
    return null;
  };
  return visit(parsed) ?? [];
}

function userExists(username: string, modeArgs: string[]): boolean {
  const sql = `SELECT id FROM users WHERE username = '${escapeSqlString(username)}'`;
  const res = runWrangler([
    "d1",
    "execute",
    DB_NAME,
    ...modeArgs,
    "--config",
    "wrangler.jsonc",
    "--json",
    "--command",
    sql
  ]);
  if (res.exitCode !== 0) {
    console.error(res.stderr.trim());
    fail(`gagal memeriksa user '${username}' (exit code ${res.exitCode})`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    fail(`gagal membaca output wrangler:\n${res.stdout}`);
  }
  return findResults(parsed).length > 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!USERNAME_RE.test(args.username)) {
    fail(
      `username tidak valid: '${args.username}' (harus 6-20 karakter: huruf, angka, tanda - _ .)`
    );
  }
  if (args.remote && !args.yes) {
    fail("--remote mengubah database produksi; tambahkan --yes untuk konfirmasi");
  }
  const mode = args.remote ? "remote" : "local";
  const modeArgs = args.remote ? ["--remote"] : ["--local"];
  console.log(`[seed:admin] mode: ${mode}, database: ${DB_NAME}, username: '${args.username}'`);

  let password = args.password;
  let generated = false;
  if (password === null) {
    password = generatePassword();
    generated = true;
  }
  const passwordHash = await hashPassword(password);

  if (userExists(args.username, modeArgs)) {
    console.log(`[seed:admin] User admin '${args.username}' sudah ada — tidak melakukan apa-apa`);
    return;
  }

  const now = Date.now();
  const id = uuidv7();
  const insert =
    `INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) ` +
    `VALUES ('${escapeSqlString(id)}', '${escapeSqlString(args.username)}', ` +
    `'${escapeSqlString(passwordHash)}', 'admin', 1, ${now}, ${now})`;
  const res = runWrangler([
    "d1",
    "execute",
    DB_NAME,
    ...modeArgs,
    "--config",
    "wrangler.jsonc",
    "--json",
    "--command",
    insert
  ]);
  if (res.exitCode !== 0) {
    console.error(res.stderr.trim());
    fail(`gagal menyimpan user '${args.username}' (exit code ${res.exitCode})`);
  }

  if (!userExists(args.username, modeArgs)) {
    fail(`verifikasi gagal: user '${args.username}' tidak ditemukan setelah INSERT`);
  }
  console.log(
    `[seed:admin] Berhasil membuat user admin '${args.username}' (role: admin, mode: ${mode})`
  );
  if (generated) {
    console.log(`[seed:admin] Password: ${password}`);
    console.log("[seed:admin] Simpan password ini sekarang, tidak ditampilkan lagi.");
  }
}

await main();
