# Runmail

Runmail — SaaS email inbox di Cloudflare Workers (Hono + D1 + R2 + Vue 3).

## Prasyarat

- Bun 1.4+

## Setup Lokal

1. Install dependensi:

   ```sh
   bun install
   ```

2. Buat file secret lokal `apps/worker/.dev.vars` (tidak di-commit, sudah di-ignore).
   Salin dari `apps/worker/.dev.vars.example` lalu isi. Formatnya:

   ```ini
   JWT_SIGNING_SECRET=<64 karakter hex>
   CLOUDFLARE_API_TOKEN=<token API Cloudflare>
   ```

   `JWT_SIGNING_SECRET` wajib 64 karakter hex (32 byte). Jangan memakai nilai
   contoh di dokumen ini sebagai secret asli.

3. Terapkan migrasi lalu seed user admin awal ke D1 lokal:

   ```sh
   cd apps/worker && bun x wrangler d1 migrations apply runmail-dev --local && cd ../..
   bun run seed:admin
   ```

   Flag `seed:admin` (skrip idempotent — aman dijalankan ulang, user yang sudah
   ada tidak akan ditimpa):

   | Flag                | Keterangan                                                                                                                             |
   | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | `--username <nama>` | Username admin, default `runmail-admin` (6-20 karakter: huruf, angka, `-` `_` `.`)                                                     |
   | `--password <pw>`   | Password admin; bila tidak diisi, dibuatkan acak 20 karakter dan ditampilkan sekali                                                    |
   | `--remote`          | Menulis ke database produksi (wajib disertai `--yes`). Baru berfungsi setelah `database_id` asli diisi di `apps/worker/wrangler.jsonc` |
   | `--yes`             | Konfirmasi untuk `--remote`                                                                                                            |

4. Jalankan worker dan web:

   ```sh
   bun run dev:worker
   bun run dev:web
   ```

## Skrip

| Skrip              | Keterangan                                          |
| ------------------ | --------------------------------------------------- |
| `dev:web`          | Menjalankan frontend Vue 3 (dev server)             |
| `dev:worker`       | Menjalankan worker Hono via wrangler dev            |
| `build`            | Build frontend web                                  |
| `lint`             | Cek Biome (`biome check .`)                         |
| `format`           | Format kode via Biome (`biome format --write .`)    |
| `typecheck`        | Typecheck keempat package (web, worker, shared, db) |
| `test`             | Unit test (bun test)                                |
| `test:integration` | Validasi migrasi Drizzle ke D1 lokal                |
| `seed:admin`       | Seed satu user admin awal ke D1 (idempotent)        |

## Catatan Konfigurasi

- Variabel non-secret (lingkungan, TTL, retensi) ada di `apps/worker/wrangler.jsonc`:
  `APP_ENV`, `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`,
  `TRASH_SPAM_RETENTION_DAYS`, `SYNC_RETENTION_DAYS`.
- Secret produksi (`JWT_SIGNING_SECRET`, `CLOUDFLARE_API_TOKEN`) dipasang saat
  deploy produksi nanti via `wrangler secret put`. Langkah deploy produksi
  sengaja belum didokumentasikan di sini.
