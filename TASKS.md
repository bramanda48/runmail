# TASKS.md — Reset ke shadcn-vue Default (Slate/Normal)

> Dipecah dari `PLAN.md` (2026-10-08). Status awal semua `[ ]`.
> Aturan tiap task: `bun run build` + typecheck + lint hijau sebelum lanjut.
> DILARANG `shadcn-vue add --overwrite` tanpa approval eksplisit.

Legenda: `[ ]` belum · `[~]` jalan · `[x]` selesai · `[!]` blokir.

## Fase 1 — Foundation

- [x] **T-01** `globals.css` → stock slate + `.dark`
  - File: `apps/web/src/styles/globals.css` (rewrite), `apps/web/index.html`
    (tambah `<link>` Inter bila belum ada — komfirmasi saat eksekusi).
  - Hapus: `--surface*`, `--success*`, `--warning*`, 4 token radius, Roboto.
  - Target: token standar + satu `--radius` + font-sans Inter + blok `.dark` stock.
  - Done: build hijau; `/login` & inbox tampil (token kustom boleh fallback dulu).

- [x] **T-02** Verifikasi Fase 1
  - Done: build + typecheck hijau; screenshot/visual `/login` & inbox dicatat
    sebagai baseline perbandingan fase berikutnya.

## Fase 2 — STOCK-CLEAN (tanpa ubah callsite)

- [x] **T-03** `button` → samakan base class stock (cek `ring-1` vs stock).
  - File: `apps/web/src/components/ui/button/index.ts`.
  - Done: diff hanya base class; build + typecheck hijau.

- [x] **T-04** `switch` → thumb `bg-surface`→`bg-background`, samakan ukuran stock.
  - File: `apps/web/src/components/ui/switch/Switch.vue`.
  - Done: build hijau; visual RulesetEditor + admin switch dicek.

- [x] **T-05** `table/*` → Row `hover:bg-muted/50`, Head `px-2`, Cell `p-2`.
  - File: `TableRow.vue`, `TableHead.vue`, `TableCell.vue`.
  - Done: build hijau; tabel admin dicek.

- [x] **T-06** `Card` root → `rounded-xl bg-card`.
  - File: `apps/web/src/components/ui/card/Card.vue`.
  - Done: build hijau; `grep bg-surface` di `ui/` berkurang satu.

- [x] **T-07** Verifikasi Fase 2
  - Done: build + typecheck hijau; visual spot-check 3 layar (login, admin tabel, dialog).

## Fase 3 — CUSTOM-API rewrite

- [x] **T-08** `alert` → `default/destructive`, hapus auto-icon + role logic
  - File: `ui/alert/index.ts`, `Alert.vue` + remap ~10 callsite
    (`error`→`destructive`, sisanya→`default`).
  - Done: `grep 'variant="(info|success|warning|error)"' src/` = nol; typecheck hijau.

- [x] **T-09** `badge` → `default/secondary/destructive/outline`
  - File: `ui/badge/index.ts`, `Badge.vue` (default `secondary` atau `default` —
    putuskan saat eksekusi) + remap ~6 callsite
    (`success`→`secondary`, `inactive/pending`→`outline`, `error`→`destructive`).
  - Done: grep varian lama = nol; typecheck hijau.

- [x] **T-10** `input` → single file stock, hapus props `variant/size`
  - File: `ui/input/*` + ~10 callsite (hapus prop; error state → `aria-invalid` +
    teks `text-destructive` manual). `MailboxSearchBar` pill via `class`, bukan varian.
  - Done: grep `variant=` pada `<Input` = nol; typecheck hijau.

- [x] **T-11** `dialog/Content` → single content stock + tombol close ✕
  - File: `ui/dialog/*` + ~7 callsite (hapus `variant/size`; cek tiap dialog
    karena tombol ✕ baru muncul).
  - Done: grep `DialogContent variant|size=` = nol; semua dialog dibuka-tutup normal.

- [x] **T-12** `select` → primitives stock multi-file
  - File: `ui/select/` (rewrite total) + ~11 callsite; `:error` di
    `AdminUsersView` + `RulesetActionRow` → pola stock.
  - Done: semua dropdown dibuka-pilih normal; typecheck hijau.

- [x] **T-13** `skeleton` → single `div` stock
  - File: `ui/skeleton/Skeleton.vue` (hapus prop `shape`) + ~8 callsite
    (komposisi per callsite).
  - Done: grep `shape=` = nol; loading state tiap layar dicek.

- [x] **T-14** Verifikasi Fase 3
  - Done: build + typecheck + lint hijau; visual tiap layar yang memakai
    alert/badge/input/dialog/select/skeleton.

## Fase 4 — NON-STOCK eviction + migrasi token

- [x] **T-15** `icon-button` → `Button size="icon"`, hapus folder
  - ~20 callsite (`ghost/sm/md` → `Button variant= size=`).
  - Done: folder `ui/icon-button/` terhapus; grep `icon-button` di `src/` = nol.

- [x] **T-16** `password-input` → `components/app/password-field.vue`
  - 4 callsite (`LoginView`, `AccountView`, `AdminUsersView` ×2).
  - Done: folder `ui/password-input/` terhapus; show/hide berfungsi di 3 layar.

- [x] **T-17** `pagination` → `components/app/` (API cursor tetap)
  - Done: folder `ui/pagination/` terhapus; prev/next + counter jalan.

- [x] **T-18** Migrasi token di views/komponen
  - `bg-surface`→`bg-card` (~12 file); `rounded-2xl`→`rounded-lg`; hapus `shadow-lg`;
    fix `wordmark` (invisible!) + star `text-warning`→`fill-primary text-primary`.
  - Done: `grep 'surface|success|warning' src/` (di luar css) = nol;
    `ui/` hanya berisi komponen stock.

- [x] **T-19** Verifikasi Fase 4
  - Done: build + typecheck + lint hijau; daftar isi `ui/` vs stock dicentang satu per satu.

## Fase 5 — Tipografi + verifikasi akhir

- [x] **T-20** H1 9 views → skala spec
  - `scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl`.
  - File: Account, AdminDomains, AdminMailboxes, AdminUsers, FolderManagement,
    MailboxInbox, MailboxSelection, RulesetEditor, RulesetList.
  - Done: 9 judul dicek visual.

- [x] **T-21** H2/H3 + subject email + `ring-2` touch-up
  - Subject `MessageDetailView` + H2/H3 diputuskan per konteks saat eksekusi.
  - `font-bold` unread di `email-row` DIPERTAHANKAN (aturan produk).
  - Done: tidak ada perubahan fungsional — diff hanya class.

- [x] **T-22** Verifikasi akhir
  - `build + typecheck + lint + format:check + bun test` semua hijau.
  - Visual pass semua route light mode + force `.dark` via DevTools (tanpa toggle).

- [x] **T-23** AGENTS.md §3 + memori
  - AGENTS.md v1.1 ditulis 2026-10-08 (§3 Design System → DESIGN.md; §5 Icon Usage Iconify mutlak; §7 violations stock-only; §8 branding Inter/star/H1). Memori hasil tersimpan di namespace `runmail`.
  - Done: approval didapat, AGENTS.md ditulis, memori tersimpan.
