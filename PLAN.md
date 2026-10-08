# PLAN.md — Reset ke shadcn-vue Default (Slate/Normal)

> Status: RENCANA — belum dieksekusi. Disusun 2026-10-08.
> Pemicu: redesign besar-besaran; `DESIGN.md` diganti manual oleh user menjadi
> "Shadcn Vue Default Theme". Komponen `ui/` direset ke stock shadcn-vue.

## 1. Latar Belakang

- Desain lama: Material Design 3-inspired tonal (`--primary #c2e7ff`, `--surface`,
  `--success`, `--warning`, font Roboto, `rounded-2xl` di mana-mana).
- Desain baru (`DESIGN.md`): shadcn-vue **default theme / slate / normal** — token
  standar saja (`background, foreground, card, popover, primary, secondary, muted,
accent, destructive, border, input, ring`), font Inter, tanpa token kustom.
- Aturan DESIGN.md: komponen basis dari `@/components/ui`; Iconify mutlak
  (`lucide-vue-next` dilarang); tanpa hex hardcode; tanpa override CSS variable
  inline; dark-mode-ready; jangan hapus ring fokus & atribut ARIA.

## 2. Keputusan User (2026-10-08, mengikat)

1. **Icon set TETAP `lucide:*`** (offline subset + `build-icon-subset` tetap).
   Contoh `mdi:*` di DESIGN.md hanya ilustrasi format Iconify.
2. **Semantic STOCK-ONLY, full remap** — hapus varian custom total:
   - Alert: `error` → `destructive`; `success/warning/info` → `default`.
   - Badge: `success` → `secondary`; `inactive/pending` → `outline`;
     `error` → `destructive`.
3. **Dark mode = token `.dark` SAJA** — tanpa UI toggle di fase reset.
4. **Heading IKUTI STANDAR shadcn-vue harfiah** — desain lama dilupakan/dihapus:
   - H1: `scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl`
   - H2: `scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0`
   - H3: `scroll-m-20 text-2xl font-semibold tracking-tight`
   - Body: `leading-7 [&:not(:first-child)]:mt-6`
   - Muted: `text-sm text-muted-foreground`
5. **Komponen `ui/` WAJIB sama dengan stock shadcn-vue.** Custom dihilangkan;
   bila tak bisa disamakan → hapus komponen, import/rewrite baru dari stock.

## 3. Hasil Audit `ui/` vs Stock (new-york, 2026-10-08)

### 3a. STOCK-CLEAN — samakan base class, tanpa ubah callsite

| Komponen                     | Selisih vs stock                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `button`                     | base `focus-visible:ring-1` (cek stock)                                                                  |
| `switch`                     | thumb `bg-surface`; ukuran `h-5/w-9` (cek stock)                                                         |
| `table/*`                    | Row `hover:bg-accent` (stock: `hover:bg-muted/50`); Head `px-4` (stock `px-2`); Cell `p-4` (stock `p-2`) |
| `card/*` (kecuali root)      | Header/Title/Content/Description/Footer sudah stock                                                      |
| `dialog/*` (kecuali Content) | Header/Title/Description/Footer sudah stock                                                              |

### 3b. CUSTOM-API — rewrite + perbaiki callsite

| Komponen         | Custom saat ini                                                                        | Stock                                                                             | Callsite                                                             |
| ---------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `alert`          | varian `info/success/warning/error` + auto-icon + role logic                           | `default/destructive` saja, tanpa auto-icon (ada `AlertTitle`/`AlertDescription`) | ~10 file                                                             |
| `badge`          | varian `success/inactive/pending/error`                                                | `default/secondary/destructive/outline`                                           | ~6 file                                                              |
| `input`          | props `variant` (`focus/disabled/error`) + `size="md"`, `bg-surface`                   | single file, tanpa varian                                                         | ~10 file                                                             |
| `dialog/Content` | props `variant` (`destructive`) + `size` (`sm/md`), `bg-surface`, tanpa tombol close ✕ | single content + tombol close ✕                                                   | ~7 file                                                              |
| `select`         | wrapper single-file (`options/label/error`)                                            | primitives multi-file (Trigger/Content/Item/Value/…)                              | ~11 file (termasuk `:error` di `AdminUsersView`, `RulesetActionRow`) |
| `skeleton`       | props `shape` (`block/list/detail/form`)                                               | single `div`                                                                      | ~8 file                                                              |

### 3c. NON-STOCK — bukan komponen shadcn; hapus dari `ui/`, pindah ke `app/`

| Komponen         | Pengganti                                                                           | Callsite                                                 |
| ---------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `icon-button`    | `Button size="icon"`                                                                | ~20 file                                                 |
| `password-input` | composite app-level (Input + Button icon), mis. `components/app/password-field.vue` | 4 file (`LoginView`, `AccountView`, `AdminUsersView` ×2) |
| `pagination`     | pindah ke `components/app/` apa adanya (stock numbered tak cocok dengan cursor API) | pemakai saat ini                                         |

### 3d. Jebakan visual yang ditemukan

- Ikon `wordmark` pakai `text-primary-foreground` → di slate terang = near-white
  → **invisible**. Wajib fix saat migrasi (mis. `bg-primary` eksplisit atau token lain).
- Star `text-warning` (`email-row`, `MessageDetailView`) → amber tidak ada di
  stock-only. Rekomendasi: `fill-primary text-primary` (putuskan saat eksekusi).
- `text-primary-foreground` di `alert info` lama ikut hilang bersama variannya.
- `MailboxSearchBar` pakai `rounded-full` pada Input — pertahankan via `class`
  (bukan varian) karena pill search = kebutuhan produk, bukan tema.

## 4. Fase Implementasi

Setiap fase independently shippable: `bun run build` + typecheck + lint hijau.

### Fase 1 — Foundation: `globals.css` default + `.dark`

- Rewrite `apps/web/src/styles/globals.css` ke stock slate:
  token standar, satu `--radius`, font-sans Inter, blok `.dark` stock.
- Hapus: `--surface*`, `--success*`, `--warning*`, 4 token radius, Roboto.
- Font Inter: tambah `<link>` Google Fonts di `index.html` bila belum ada
  (komfirmasi saat eksekusi — [INFERENCE] kemungkinan baru system fallback).
- Verifikasi: build + buka `/login` & inbox.
- Estimasi: kecil, 1–2 file.

### Fase 2 — STOCK-CLEAN (`button/switch/table/card-parts/dialog-parts`)

- Samakan base class ke stock: `button` (cek `ring-1`), `switch` thumb
  `bg-surface` → `bg-background`, `table` (`hover:bg-muted/50`, `px-2`, `p-2`),
  `Card` root `rounded-2xl bg-surface` → `rounded-xl bg-card`.
- Tanpa perubahan callsite.
- Verifikasi: build + typecheck + visual spot-check.

### Fase 3 — CUSTOM-API rewrite (`alert/badge/input/dialog/select/skeleton`)

- Ambil referensi stock via `bunx shadcn-vue@latest add <komponen> --dry-run` /
  `--diff`, lalu tulis ulang file. **DILARANG `--overwrite` tanpa approval
  eksplisit** (aturan skill shadcn-vue).
- Remap callsites (detail §2.2):
  - `Input variant=...` → hapus prop; error state jadi `aria-invalid` +
    teks `text-destructive` manual.
  - `DialogContent variant/size` → hapus prop; tombol close ✕ stock muncul —
    cek tiap dialog.
  - `Select :error` (2 file) → pola stock; `Skeleton shape` (8 file) →
    komposisi `Skeleton` stock per callsite.
- Boleh dipecah: 3a (alert/badge), 3b (input/dialog), 3c (select/skeleton).
- Verifikasi per komponen: grep prop lama = nol; typecheck (cva men-typecheck
  varian); visual tiap layar.
- Estimasi: terbesar.

### Fase 4 — NON-STOCK eviction + migrasi token di views

- `icon-button` → `Button size="icon"` (~20 callsite) lalu hapus folder.
- `password-input` → `components/app/password-field.vue` (4 callsite).
- `pagination` → `components/app/` tanpa ubah API cursor.
- Token di views/komponen: `bg-surface` → `bg-card` (~12 file);
  `rounded-2xl` → `rounded-lg`; hapus `shadow-lg`; fix `wordmark` + star.
- Verifikasi: `ui/` hanya berisi komponen stock;
  grep `surface|success|warning` di `src/` (di luar css) = nol.

### Fase 5 — Tipografi skala spec + verifikasi akhir

- H1 halaman → skala §2.4 (9 views); subject email + H2/H3 diputuskan per
  konteks saat eksekusi.
- `font-bold` unread di `email-row` DIPERTAHANKAN (aturan produk/PRD, bukan tema).
- `focus-visible:ring-1` → `ring-2` bila menyentuh file (DESIGN.md melarang
  hapus ring; stock button pakai `ring-2`).
- `build + typecheck + lint + format:check + bun test`; visual pass semua
  route light mode + force `.dark` via DevTools.
- Usulan update AGENTS.md §3 (tunggu approval, sesuai aturan self-update) +
  simpan memori hasil.

## 5. Di Luar Cakupan (redesign sesungguhnya, setelah reset)

Layout ulang inbox multi-panel, empty states baru, command palette, theme
toggle, ganti icon set, density/spacing system baru.

## 6. Referensi Audit

- `DESIGN.md` (root) — sumber aturan baru.
- `apps/web/src/styles/globals.css` — tema lama (1 file rewrite).
- `apps/web/src/components/ui/{alert,badge,input,dialog,select,skeleton}/`
  — CUSTOM-API; `{icon-button,password-input,pagination}/` — NON-STOCK.
- Callsites: `AccountView`, `AdminDomainsView`, `AdminMailboxesView`,
  `AdminUsersView`, `FolderManagementView`, `LoginView`, `MailboxInboxView`,
  `MailboxSelectionView`, `MessageDetailView`, `RulesetEditorView`,
  `RulesetListView`, `EmailListContainer`, `EmailMoveDialog`, `email-row`,
  `remote-image-notice`, `admin-shell`, `app-shell`, `MobileNavDrawer`,
  `mailbox-switcher`, `sync-indicator`, `MailboxSearchBar`,
  `RulesetActionRow`, `RulesetConditionRow`, `wordmark`, `empty-state`.
