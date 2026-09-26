# AGENTS.md

## 1. Tentang Proyek

**Runmail** — SaaS email inbox modern berbasis Cloudflare Workers dengan mailbox sebagai tenant boundary.

**Status:** Awal development — struktur monorepo sudah dibuat, dokumentasi lengkap (PRD v0.5, Tech Plan v0.5, UI/UX Spec v0.2), implementasi fitur dimulai bertahap.

**Konteks Unik:**
- **Mailbox = Tenant:** Tidak ada entitas workspace/tenant terpisah. Satu user bisa mengelola banyak mailbox, satu mailbox bisa dikelola banyak user dengan hak yang sama.
- **Delta Sync Architecture:** Frontend hanya fetch perubahan sejak cursor terakhir menggunakan monotonic sync_version per mailbox.
- **On-Demand Raw Email:** .eml tidak auto-download; hanya di-fetch saat detail message dibuka.
- **Optimistic UI:** Read/star/move langsung update lokal + masuk persistent sync queue.


## 2. Tech Stack

### Backend
- **Runtime:** Cloudflare Workers
- **Framework:** Hono v4
- **Database:** Cloudflare D1 (metadata/index) + Drizzle ORM v0.44
- **Storage:** Cloudflare R2 (raw RFC-822 .eml)
- **Auth:** Bearer JWT HS256 (15 menit) + rotating refresh token (30 hari)
- **Email Ingest:** Cloudflare Email Routing
- **Password:** bcrypt-ts
- **Validation:** Zod v4
- **MIME Parsing:** postal-mime v3

### Frontend
- **Framework:** Vue 3.5 + TypeScript
- **Build Tool:** Vite v6
- **Router:** Vue Router v4
- **State:** Pinia v4
- **Design System:** shadcn-vue (reka-ui v2 primitives)
- **Styling:** Tailwind CSS v4
- **Icons:** Iconify (@iconify/vue) dengan Lucide sebagai icon set utama (lucide:*)
- **Local DB:** Dexie v4 (IndexedDB wrapper) — satu database per mailbox
- **Local Cache:** Browser Cache API untuk raw .eml
- **MIME Parsing:** postal-mime v3
- **HTML Sanitization:** DOMPurify v3

### Monorepo & Tooling
- **Package Manager:** Bun v1.4+
- **Monorepo:** Bun workspaces
- **Linter:** ESLint v10 + typescript-eslint v8 + eslint-plugin-vue v10
- **Formatter:** Prettier v3
- **Git Hooks:** simple-git-hooks v2 + lint-staged v17
- **TypeScript:** v5.7, strict mode, verbatimModuleSyntax, isolatedModules


## 3. Prinsip Arsitektur

### Modular Monolith
Backend menggunakan modular monolith agar autentikasi, user, domain, mailbox, email ingest, inbox, folder, ruleset, sinkronisasi, raw email, dan retention memiliki boundary kode yang jelas tetapi sederhana untuk dikembangkan dan dideploy.

### Mailbox-Scoped Everything
- Semua route mailbox-scoped membawa mailbox_id eksplisit di URL: /mailboxes/:mailbox_id/inbox
- Setiap mailbox memiliki database Dexie tersendiri untuk local projection
- Hanya mailbox aktif yang menjalankan sync lifecycle; queue mailbox lain tetap persisten
- Repository/query backend wajib menerima dan memvalidasi mailbox_id untuk isolasi data

### Frontend State Management
- **Pinia stores:** untuk auth, active mailbox selection, UI state global
- **Dexie (IndexedDB):** per-mailbox local projection untuk messages, folders, sync_state, sync_queue
- **Cache API:** best-effort storage untuk raw .eml yang pernah dibuka
- **Optimistic updates:** mutation lokal langsung diterapkan ke Dexie + masuk persistent queue

### Data Flow
1. **Inbound Email:** Email Routing → Worker → validasi domain/mailbox/ukuran/ruleset → R2 (raw) → D1 (metadata) → sync event
2. **Frontend Sync:** Delta sync dari D1 → apply ke Dexie lokal → UI update
3. **Message Detail:** Cek Cache API → fetch raw dari R2 via Worker → simpan ke Cache → parse postal-mime → render
4. **Mutation:** UI optimistic → Dexie update → sync queue → batch POST ke backend → apply sync_version

### Design System
Material Design 3-inspired dengan tonal elevation (no heavy shadow), pill shapes untuk high-interaction elements, strict typography hierarchy (unread = weight 700), shadcn-vue components, Lucide icons only.


## 4. Setup & Command

### Initial Setup
```bash
# 1. Install dependencies
bun install

# 2. Buat .dev.vars di apps/worker/ (lihat apps/worker/.dev.vars.example)
# Isi: JWT_SIGNING_SECRET (64 hex chars), CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

# 3. Apply migrations + seed admin user
cd apps/worker && bun x wrangler d1 migrations apply runmail-dev --local && cd ../..
bun run seed:admin
```

### Development
```bash
bun run dev:worker    # Worker backend (wrangler dev)
bun run dev:web       # Frontend (vite dev server)
```

### Build & Quality
```bash
bun run build         # Build frontend
bun run typecheck     # Typecheck semua packages
bun run lint          # ESLint check
bun run lint:fix      # ESLint auto-fix
bun run format        # Prettier write
bun run format:check  # Prettier check
```

### Testing
```bash
bun test                 # Unit tests
bun run test:integration # Validasi migrations
```

### Database & Seed
```bash
# Local D1 migrations
cd apps/worker && bun x wrangler d1 migrations apply runmail-dev --local

# Seed admin user (idempotent)
bun run seed:admin [--username] [--password] [--remote --yes]
```


## 5. Konvensi Kode

### Naming Conventions
- **Files/Folders:** kebab-case (email-list.vue, sync-queue.ts)
- **Vue Components:** PascalCase export, kebab-case filename (EmailList.vue exports EmailList)
- **TypeScript:** PascalCase untuk types/interfaces/classes, camelCase untuk functions/variables
- **Constants:** SCREAMING_SNAKE_CASE untuk true constants
- **Packages:** scoped dengan @runmail/* (@runmail/web, @runmail/worker, @runmail/db, @runmail/shared)

### Code Style
- **TypeScript strict mode:** wajib untuk semua packages
- **No any:** gunakan unknown atau type spesifik; any hanya di-warn ESLint
- **Unused vars:** prefix dengan _ untuk parameter yang sengaja tidak dipakai
- **Vue Composition API:** <script setup> dengan TypeScript untuk semua SFC
- **No multi-word enforcement:** vue/multi-word-component-names off
- **HTML self-closing:** wajib untuk semua elemen (<div />, <MyComponent />)
- **No v-html:** rule off karena sanitized email rendering memerlukan v-html dengan DOMPurify
- **Import organization:** otomatis via prettier-plugin-organize-imports
- **Indent:** 2 spaces untuk semua file

### Icon Usage
- **Framework:** @iconify/vue dengan icon set Lucide (lucide:*)
- **Konsistensi:** jangan campur icon set lain untuk navigasi/action utama
- **Centralized names:** nama icon berulang dipusatkan via mapping/constant di src/icons/
- **Icon subset build:** bun run build:icons untuk generate subset yang dipakai; build production akan check subset


### Component Organization
- **apps/web/src/components/ui/** — shadcn-vue generated/adapted components
- **apps/web/src/components/app/** — Runmail-specific reusable components
- **apps/web/src/components/email/** — Email-specific components (list, row, detail, toolbar)
- **apps/web/src/views/** — Screen/page components
- **apps/web/src/router/** — Vue Router config
- **apps/web/src/stores/** — Pinia stores
- **apps/web/src/db/** — Dexie schema dan helpers
- **apps/web/src/sync/** — Delta sync logic
- **apps/web/src/composables/** — Reusable composition functions

### Backend Modules
- **apps/worker/src/modules/** — modular domain logic (auth, users, domains, mailboxes, mail, inbox, folders, rulesets, sync, retention)
- **apps/worker/src/middleware/** — Hono middleware (auth, mailbox authorization, validation)
- **apps/worker/src/email/** — Inbound email handler
- **apps/worker/src/lib/** — Shared utilities

### API Conventions
- **Prefix:** /api/v1
- **Response envelope:** { data, meta } untuk success; { error: { code, message } } untuk error
- **Pagination:** opaque cursor, default limit 10, return next_cursor dan has_more
- **Validation errors:** structured field-level errors untuk form submission (misal duplicate mailbox address return field local_part error)

### Database Conventions
- **IDs:** UUID v7 untuk primary keys server-side
- **Timestamps:** Unix timestamp milliseconds UTC (INTEGER) di D1
- **Naming:** snake_case untuk column/table names
- **Migrations:** Drizzle Kit di packages/db/migrations/, wajib divalidasi via bun run test:integration sebelum commit
- **No JSON columns:** ruleset conditions/actions disimpan sebagai tabel relasional, bukan JSON


## 6. Testing

### Framework
- **Unit:** Bun test (built-in)
- **Integration:** custom scripts (migrations validation)

### What to Test
- **Backend:** ruleset matcher, match types, priority, action ordering, validation, auth helpers, sync helpers, D1 constraints, Drizzle migrations, mailbox isolation
- **Frontend:** Dexie schema migration, local projection logic, sync state, queue persistence, optimistic updates
- **Email Ingest:** valid inbound flow, unknown local-part rejection, oversized rejection, no-rule-match rejection, R2→D1 failure compensation

### Pre-Commit
Git hooks menjalankan lint-staged:
- ESLint auto-fix + Prettier untuk .ts, .js, .vue
- Prettier untuk .json, .yaml

**Tidak ada automatic test run di pre-commit hook.** Test dijalankan manual atau via CI.

## 7. Hal yang Harus Dihindari

### Files/Folders Sensitif
- **.dev.vars** — secret lokal, sudah di-ignore, JANGAN commit
- **wrangler.jsonc** — berisi config non-secret; database_id produksi belum diisi sampai deployment
- **node_modules/, dist/, .wrangler/** — sudah di-ignore

### Secret Management
- **Local development:** secret di apps/worker/.dev.vars
- **Production:** secret via wrangler secret put (belum didokumentasikan setup produksi)
- **JANGAN hardcode:** JWT secret, API token, account ID di source code

### Branch Protection
- **Main branch:** belum ada explicit protection rule, tapi praktik: merge hanya setelah typecheck + lint + test lokal lolos
- **No force push:** ke main/production branches


### Breaking Changes
- **Schema migrations:** harus backward-compatible atau dilakukan secara koordinasi deployment
- **API contracts:** jangan ubah response envelope structure atau field types tanpa versioning
- **Dexie schema:** perubahan schema wajib disertai Dexie migration version bump

### Design System Violations
- **No heavy drop shadows:** depth harus dari tonal elevation
- **No mixed icon sets:** gunakan Lucide saja untuk konsistensi stroke/proporsi
- **No generic component modifications:** shadcn-vue components di components/ui/ adalah source code aplikasi, review setiap perubahan

## 8. Belum Diputuskan

### Testing Strategy Detail
- **Coverage threshold:** belum ditetapkan minimum coverage
- **E2E framework:** belum dipilih (Playwright? Cypress?)
- **CI pipeline:** belum dikonfigurasi (GitHub Actions? Cloudflare?)

**Instruksi Agent:** Saat pertama kali setup CI atau E2E test diminta, propose 2-3 opsi dengan tradeoff singkat, tunggu keputusan, lalu update AGENTS.md.

### Deployment Strategy
- **Production deployment workflow:** belum didokumentasikan
- **Environment variables produksi:** database_id, bucket_name, secret injection belum dikonfigurasi
- **Rollback strategy:** belum ditetapkan

**Instruksi Agent:** Jangan invent deployment script sendiri. Saat deployment pertama kali diperlukan, minta klarifikasi environment target dan approval sebelum eksekusi.


### Error Monitoring & Logging
- **Error tracking service:** belum dipilih (Sentry? Cloudflare logging saja?)
- **Structured logging format:** sudah disebut di Tech Plan (JSON + request_id) tapi belum diimplementasi
- **Alert thresholds:** belum ditetapkan

**Instruksi Agent:** Saat implementasi logging/monitoring pertama kali, tanyakan preferensi service dan budget sebelum integrate third-party.

### i18n/Localization
- **Bahasa UI:** draft menggunakan Bahasa Indonesia, tapi keputusan final bahasa produk belum dikunci di PRD
- **i18n framework:** belum dipilih (vue-i18n? Intl API langsung?)

**Instruksi Agent:** Jika diminta implementasi multi-bahasa, tanyakan target bahasa dan preferensi library sebelum struktur file i18n dibuat.

### Admin UI Details
- **User management search/filter:** belum menjadi requirement MVP
- **Bulk operations:** (bulk user deactivate, bulk mailbox assignment) belum diputuskan

**Instruksi Agent:** Jangan tambahkan fitur admin diluar PRD tanpa konfirmasi eksplisit. Jika diminta, tanyakan scope dan priority.

### Branding Final
- **Logo/wordmark Runmail:** belum tersedia, gunakan text wordmark netral
- **Font final:** Roboto atau Inter belum dikunci (spec fallback keduanya)
- **Error color token:** #B3261E digunakan sementara karena DESIGN.md belum definisikan

**Instruksi Agent:** Saat branding asset/final font tersedia, update design tokens di Tailwind config dan AGENTS.md.


## 9. Instruksi Self-Update

**Agent wajib mengusulkan update AGENTS.md setiap kali:**
1. **Keputusan struktural baru diambil:** misal pilihan E2E framework, logging service, i18n library
2. **Konvensi kode baru muncul:** misal pattern baru untuk composables, store organization, atau error handling
3. **Hal 'Belum Diputuskan' mendapat keputusan:** pindahkan dari section 8 ke section yang relevan
4. **Batasan/assumption berubah:** misal MVP scope expansion, tech stack upgrade, atau constraint baru
5. **Setup/command baru ditambahkan:** misal production deploy script, migration rollback command

**Format usulan update:**
```
## Usulan Update AGENTS.md

**Section:** [nomor section]
**Reason:** [1-2 kalimat kenapa update diperlukan]
**Proposed Change:**
[diff atau konten baru]
```

Tunggu approval sebelum menulis perubahan ke AGENTS.md.

---

**Versi:** 1.0  
**Terakhir Update:** 26 September 2026  
**Maintainer:** Project team
