# UI/UX SPEC

## Runmail

**STATUS: DRAFT SEMENTARA**

|                   |                                     |
| ----------------- | ----------------------------------- |
| **Nama Produk**   | Runmail                             |
| **Versi Dokumen** | v0.2                                |
| **Disusun oleh**  | Pengembang                          |
| **Dokumen Acuan** | PRD v0.5, Tech Plan v0.5, DESIGN.md |
| **Tanggal**       | 9 September 2026                    |

---

# 1. Ringkasan

Runmail adalah responsive web application untuk pengelolaan inbox email SaaS dengan mailbox sebagai tenant boundary. UI dirancang sebagai SPA produktivitas dengan pendekatan Material Design 3-inspired: layout multi-panel pada desktop, transisi ke drawer/single-panel pada mobile, tonal elevation tanpa heavy shadow, serta hirarki visual yang mengutamakan scanning daftar email. Frontend menggunakan Vue 3, shadcn-vue, Tailwind CSS, dan Iconify dengan Lucide sebagai icon set utama. UI harus tetap merefleksikan batasan teknis Runmail: metadata utama dibaca dari Dexie per mailbox, raw `.eml` di-fetch on-demand, mutation read/star/move bersifat optimistic dan persisten melalui sync queue, serta seluruh route mailbox-scoped membawa `mailbox_id` eksplisit.

# 2. Design System

## 2.1 Warna

| **Token**           | **Hex**   | **Penggunaan**                                         |
| ------------------- | --------- | ------------------------------------------------------ |
| Canvas / Background | `#F6F8FC` | Background utama aplikasi dan area di luar surface.    |
| Surface             | `#FFFFFF` | Main content container, dialog, sheet, form container. |
| Surface Hover       | `#F3F4F6` | Hover row, secondary interactive surface.              |
| Primary Tonal       | `#C2E7FF` | Active navigation, selected state, primary tonal CTA.  |
| Accent / Action     | `#0B57D0` | Icon/text aktif, link, focus accent, action penting.   |
| Text Primary        | `#1F1F1F` | Heading, subject unread, body text utama.              |
| Text Secondary      | `#444746` | Metadata, caption, helper text, read message text.     |
| Border              | `#E5E7EB` | Divider ringan, input border, structural separator.    |
| Success             | `#146C2E` | Status berhasil/active.                                |
| Warning             | `#E27200` | Pending verification, caution state.                   |
| Error               | `#B3261E` | Validation error, destructive/error state.             |

**Catatan:** `#B3261E` belum berasal dari `DESIGN.md`; digunakan sebagai asumsi error token sampai brand token final dikunci.

## 2.2 Tipografi

| **Elemen**      | **Font**                  | **Ukuran** | **Weight** |
| --------------- | ------------------------- | ---------- | ---------- |
| Heading 1       | Roboto, Inter, sans-serif | 1.5rem     | 600        |
| Heading 2       | Roboto, Inter, sans-serif | 1.125rem   | 600        |
| Body Bold       | Roboto, Inter, sans-serif | 0.875rem   | 700        |
| Body Regular    | Roboto, Inter, sans-serif | 0.875rem   | 400        |
| Label / Caption | Roboto, Inter, sans-serif | 0.75rem    | 500        |

Aturan utama:

- Message **unread** menggunakan weight 700 pada sender dan subject.
- Message **read** menggunakan weight 400 dan text secondary bila sesuai konteks.
- Hirarki mengandalkan typography + tonal contrast, bukan shadow berat.

## 2.3 Spacing & Layout

- Skala spacing dasar: `4 / 8 / 16 / 24 / 32px`.
- Radius: `4 / 8 / 12 / 16px`; `9999px` hanya untuk pill/high-interaction element.
- Main content menggunakan surface putih di atas canvas `#F6F8FC`, umumnya radius 16px.
- Desktop menggunakan dashboard multi-panel: navigation/sidebar + main content + optional detail/secondary panel.
- Tablet/mobile menggunakan drawer/sheet untuk navigation dan satu main panel aktif.
- Search bar, active nav item, dan high-interaction tonal action boleh menggunakan pill shape.
- Hindari heavy drop shadow. Depth berasal dari tonal elevation dan spacing.
- Teks panjang seperti alamat email/subject mengikuti controlled truncation/wrap agar layout tidak pecah.

## 2.4 Ikon & Imagery

- Framework icon: Iconify melalui `@iconify/vue`.
- Icon set utama: Lucide (`lucide:*`).
- Jangan mencampur icon set pada navigasi/action utama agar stroke dan proporsi konsisten.
- Icon-only button wajib memiliki accessible label/tooltip yang jelas.
- MVP tidak membutuhkan foto atau ilustrasi dekoratif. Empty/error states mengandalkan icon sederhana dan copy yang informatif.

# 3. Asumsi & Batasan

## 3.1 Asumsi Desain

- Bahasa UI draft menggunakan Bahasa Indonesia; keputusan final bahasa produk belum dikunci di PRD.
- Font final antara Roboto atau Inter belum dikunci; spec menggunakan fallback keduanya.
- Error token `#B3261E` digunakan sementara karena `DESIGN.md` belum mendefinisikan warna error.
- Wordmark/logo Runmail final belum tersedia; gunakan text wordmark netral selama implementasi awal.
- Numeric priority pada ruleset ditampilkan sebagai field angka eksplisit; angka lebih kecil berarti dieksekusi lebih dahulu.

## 3.2 Batasan dari Sisi Teknis

- Tidak ada Compose/Send email dalam MVP. `button-compose` pada `DESIGN.md` hanya menjadi referensi visual, bukan fitur.
- Mailbox adalah tenant boundary. Semua state message/folder/ruleset/sync harus terikat mailbox aktif.
- Frontend memakai database Dexie terpisah per mailbox.
- Hanya mailbox aktif yang menjalankan sync lifecycle. Queue mailbox lain tetap persisten dan tidak diproses dalam scope mailbox aktif.
- Route mailbox-scoped membawa `mailbox_id` eksplisit pada URL.
- Setelah login, jika hanya tersedia satu mailbox dan `has_more = false`, mailbox tersebut di-auto-select dan user langsung masuk Inbox.
- List message, mailbox selection, user, domain, mailbox management, dan ruleset menggunakan cursor pagination default 10 item per batch.
- Search MVP hanya terhadap metadata lokal `from`, `to`, dan `subject`; tidak mencari body email.
- Ruleset tidak disimpan di Dexie; ruleset di-fetch dari server saat halaman ruleset dibuka.
- Read/unread, star/unstar, dan move message menggunakan optimistic update + persistent sync queue.
- Jika mutation gagal karena koneksi, mutation tetap pending/retry; jika backend menolak secara definitif, frontend rollback ke server state.
- Cursor sync yang tidak tersedia dapat menghasilkan `full_resync_required`; metadata lokal dibangun ulang, pending queue dipertahankan lalu direplay.
- Raw `.eml` tidak otomatis di-download saat sync metadata; hanya di-fetch saat detail dibuka bila Cache API miss.
- HTML email disanitasi dan remote images diblokir default.
- User dapat memilih memuat remote image **hanya untuk message yang sedang dibuka**; tidak ada whitelist sender/domain persisten pada MVP.
- Permanent delete hanya tersedia ketika message berada di Trash.
- Trash dan Spam memiliki retention 30 hari.
- Mailbox inactive tidak dapat dibuka dan tidak menerima inbound email.
- Domain harus `active` sebelum mailbox dapat dibuat.
- Tidak ada hard delete user/mailbox pada MVP; keduanya menggunakan activate/deactivate.
- Duplicate `(domain, local_part)` pada create mailbox dikembalikan sebagai structured validation error dan ditampilkan sebagai field-level error pada `local_part`.

# 4. Komponen Dasar (Design Components)

| **Komponen**            | **Varian/State**                                               | **Deskripsi**                                                            |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| App Shell               | Desktop / Tablet / Mobile                                      | Struktur utama sidebar/drawer, top region, dan main surface.             |
| Wordmark                | Default                                                        | Text/logo Runmail di area branding.                                      |
| Button                  | Primary / Secondary / Ghost / Destructive / Disabled / Loading | Aksi utama dan sekunder berbasis shadcn-vue.                             |
| Icon Button             | Default / Hover / Active / Disabled                            | Action compact seperti star, refresh, move, more, delete.                |
| Text Input              | Default / Focus / Disabled / Error                             | Input username, folder name, local-part, ruleset value.                  |
| Number Input            | Default / Focus / Disabled / Error                             | Input numeric ruleset priority.                                          |
| Password Input          | Default / Focus / Error                                        | Password dengan show/hide control.                                       |
| Search Bar              | Default / Focus / Has Query / Disabled                         | Search lokal metadata inbox.                                             |
| Select / Combobox       | Default / Open / Selected / Error                              | Domain, role, folder destination, field, match type, action type.        |
| Checkbox / Switch       | Checked / Unchecked / Disabled                                 | State boolean seperti enabled ruleset atau status aktif.                 |
| Badge / Status Chip     | Active / Inactive / Pending / Warning / Error                  | Status user/domain/mailbox/ruleset.                                      |
| Navigation Item         | Default / Hover / Active                                       | Sidebar/drawer navigation dengan active tonal pill.                      |
| Mailbox Switcher        | Default / Open / Loading / Error                               | Menampilkan mailbox aktif dan akses switch mailbox.                      |
| Folder Navigation       | Default / Active / Empty Custom                                | Navigasi system/custom folder.                                           |
| Page Header             | Default / With Actions                                         | Judul screen, breadcrumb/context, action utama.                          |
| Surface Container       | Default                                                        | Container utama putih, radius 16px tanpa heavy shadow.                   |
| Data Table / Admin List | Default / Loading / Empty / Error                              | List users/domains/mailboxes dengan responsive adaptation.               |
| Email List              | Default / Loading / Empty / Error                              | Daftar message pada folder aktif.                                        |
| Email Row               | Read / Unread / Selected / Hover / Pending                     | Sender, subject, snippet, date, star, read emphasis.                     |
| Pagination Control      | Default / First Page / Last Page / Loading                     | Cursor-based navigation 10 item per batch.                               |
| Message Toolbar         | Default / Trash Context / Pending                              | Read/unread, star, move, trash/permanent delete.                         |
| Sync Indicator          | Synced / Syncing / Pending / Offline / Error / Full Resync     | Informasi status local projection dan queue.                             |
| Skeleton                | List / Detail / Form                                           | Loading placeholder tanpa layout shift besar.                            |
| Empty State             | Generic / Search / Mailbox / Folder / Admin                    | Icon + heading + explanation + optional action.                          |
| Alert / Inline Message  | Info / Success / Warning / Error                               | Pesan persist di dalam screen/form.                                      |
| Toast                   | Success / Info / Error                                         | Feedback singkat non-field-level.                                        |
| Dialog                  | Default / Destructive / Loading                                | Confirmation dan small form pada desktop.                                |
| Sheet / Drawer          | Navigation / Form / Detail                                     | Responsive container untuk mobile/tablet.                                |
| Form Field              | Default / Required / Error / Disabled                          | Label + input + description + field error.                               |
| Tabs                    | Default / Active                                               | Digunakan hanya bila benar-benar diperlukan dalam detail/config.         |
| Rule Builder            | Default / Validation Error                                     | Container condition/action editor.                                       |
| Rule Condition Row      | Default / Dragging / Error                                     | Field + match type + value + reorder controls + remove.                  |
| Rule Action Row         | Default / Dragging / Error                                     | Action type + value + reorder controls + remove.                         |
| Reorder Controls        | Drag Handle / Move Up / Move Down / Disabled                   | Reorder accessible untuk condition/action; drag bukan satu-satunya cara. |
| Remote Image Notice     | Blocked / Loading / Loaded / Error                             | Banner di message detail dengan action load image per-message.           |
| Error State             | Inline / Full Surface                                          | Error dengan retry/action bila relevan.                                  |

# 5. Daftar Screen

| **Screen ID** | **Nama Screen**             | **Peran Pengguna**                     | **Terkait FR (PRD)**                                        | **Diakses dari**                                               |
| ------------- | --------------------------- | -------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| SCR-1         | Login                       | Admin, Member                          | AUTH-1–AUTH-11                                              | Entry aplikasi / session expired                               |
| SCR-2         | Mailbox Selection           | Admin, Member                          | MBX-5–MBX-10, SYNC-1–SYNC-10                                | Login jika >1 mailbox, Mailbox Switcher, invalid mailbox route |
| SCR-3         | Inbox / Folder Message List | Admin, Member yang punya akses mailbox | INBX-1–INBX-8, SRCH-1–SRCH-7, OPTI-1–OPTI-4, SYNC-1–SYNC-12 | Mailbox Selection / auto-select / folder navigation            |
| SCR-4         | Message Detail              | Admin, Member yang punya akses mailbox | INBX-2–INBX-7, EML-1–EML-7, OPTI-1–OPTI-4                   | Message List                                                   |
| SCR-5         | Folder Management           | Admin, Member yang punya akses mailbox | FOLD-1–FOLD-8                                               | Mailbox workspace/navigation                                   |
| SCR-6         | Ruleset List                | Admin, Member yang punya akses mailbox | RULE-1–RULE-17                                              | Mailbox workspace/navigation                                   |
| SCR-7         | Ruleset Editor              | Admin, Member yang punya akses mailbox | RULE-2–RULE-17                                              | Ruleset List                                                   |
| SCR-8         | Account / Change Password   | Admin, Member                          | AUTH-6–AUTH-9                                               | User menu                                                      |
| SCR-9         | User Management             | Admin                                  | USER-1–USER-4, AUTH-10–AUTH-11                              | Admin navigation                                               |
| SCR-10        | Domain Management           | Admin                                  | DOMN-1–DOMN-6                                               | Admin navigation                                               |
| SCR-11        | Mailbox Management          | Admin                                  | MBX-1–MBX-10                                                | Admin navigation                                               |

# 6. Detail Per Screen

## 6.1 SCR-1 — Login

**Tujuan:** Mengautentikasi user dengan username/password dan mengarahkan user ke mailbox yang dapat dikelolanya.

**Komponen di screen ini:**

- Wordmark
- Surface Container
- Form Field
- Text Input
- Password Input
- Button
- Alert / Inline Message

**State:**

| **State**                   | **Kondisi Muncul**                                                              | **Tampilan/Perilaku**                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Default                     | Belum submit                                                                    | Form username + password + tombol Login. Tidak ada link register.                            |
| Loading                     | Request login berjalan                                                          | Tombol loading, input dinonaktifkan sementara untuk mencegah double submit.                  |
| Empty                       | Input belum diisi                                                               | Validasi required muncul sesuai interaction/submit.                                          |
| Error                       | Kredensial invalid / server error                                               | Error autentikasi ditampilkan tanpa membocorkan detail sensitif; form tetap dapat digunakan. |
| Success: Single Mailbox     | Login berhasil, page pertama mailbox berisi tepat 1 item dan `has_more = false` | Mailbox di-auto-select lalu navigasi langsung ke route Inbox mailbox tersebut.               |
| Success: Multiple Mailboxes | Login berhasil dan mailbox tidak memenuhi kondisi auto-select                   | Navigasi ke SCR-2 Mailbox Selection.                                                         |

**Interaksi Utama:**

1. User mengisi username dan password lalu memilih Login.
2. Frontend menyimpan access token di memory dan refresh token sesuai Tech Plan.
3. Frontend mengambil page pertama `/mailboxes`.
4. Jika tepat satu mailbox dan tidak ada page lanjutan, buka Inbox mailbox tersebut.
5. Jika lebih dari satu atau masih ada page lanjutan, buka Mailbox Selection.

**Referensi Visual:** `DESIGN.md` — tonal surface, rounded container, shadcn-vue input/button.

---

## 6.2 SCR-2 — Mailbox Selection

**Tujuan:** Memungkinkan user memilih mailbox aktif ketika user memiliki lebih dari satu mailbox yang tersedia.

**Komponen di screen ini:**

- App Shell minimal
- Wordmark
- Surface Container
- Mailbox selection list/card
- Badge / Status Chip
- Pagination Control
- Skeleton
- Empty State
- Error State

**State:**

| **State** | **Kondisi Muncul**                                | **Tampilan/Perilaku**                                                                                                |
| --------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Default   | Daftar mailbox tersedia                           | Tampilkan maksimal 10 mailbox untuk batch aktif; mailbox inactive tidak dapat dipilih.                               |
| Loading   | Initial load atau pindah batch                    | Skeleton list; pagination yang sedang dipakai masuk loading state.                                                   |
| Empty     | User tidak memiliki mailbox yang dapat diakses    | Empty state menjelaskan belum ada mailbox tersedia; admin dapat diarahkan ke management bila hak akses memungkinkan. |
| Error     | Fetch mailbox gagal                               | Error state dengan Retry.                                                                                            |
| Paginated | `has_more = true` atau ada cursor page sebelumnya | Pagination Control aktif untuk batch 10 item.                                                                        |

**Interaksi Utama:**

1. Memilih mailbox valid membuka route mailbox-scoped Inbox.
2. Frontend membuka Dexie DB target lalu menampilkan local projection bila tersedia.
3. Delta sync target berjalan di background setelah mailbox aktif ditentukan.
4. Pagination mengambil batch mailbox berikutnya/sebelumnya tanpa mengubah mailbox aktif sampai user memilih mailbox baru.

**Referensi Visual:** card/list selection sederhana dengan active tonal state dari `DESIGN.md`.

---

## 6.3 SCR-3 — Inbox / Folder Message List

**Tujuan:** Menjadi workspace utama untuk membaca daftar message, berpindah folder/mailbox, melakukan local search, dan menjalankan mutation utama.

**Komponen di screen ini:**

- App Shell
- Mailbox Switcher
- Folder Navigation
- Search Bar
- Page Header
- Email List
- Email Row
- Message Toolbar / row actions
- Pagination Control
- Sync Indicator
- Sheet / Drawer
- Skeleton
- Empty State
- Error State

**State:**

| **State**         | **Kondisi Muncul**                                            | **Tampilan/Perilaku**                                                                                              |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Default           | Local projection tersedia                                     | Render message dari Dexie untuk folder aktif; unread menggunakan weight 700.                                       |
| Loading           | Dexie target belum siap / initial page belum tersedia         | Skeleton message list; shell/navigation tetap stabil.                                                              |
| Empty             | Folder aktif tidak berisi message                             | Empty state sesuai folder.                                                                                         |
| Search No Result  | Query valid tetapi tidak ada hasil local metadata             | Empty search state, query tetap terlihat.                                                                          |
| Error             | Gagal membuka local projection / fetch server yang diperlukan | Error state dengan Retry/recovery.                                                                                 |
| Syncing           | Local projection sudah tampil, delta sync masih berjalan      | UI tetap usable; Sync Indicator menunjukkan syncing.                                                               |
| Offline / Pending | Mutation tersimpan di queue karena network                    | Perubahan optimistic tetap terlihat; pending indicator muncul tanpa memblokir navigasi.                            |
| Full Resync       | Backend meminta rebuild metadata                              | Tampilkan status resync; queue pending dipertahankan; hindari misleading “all synced”.                             |
| Page Loading      | User pindah cursor batch message                              | List dapat menampilkan skeleton/disabled pagination sesuai implementasi tanpa menghilangkan keseluruhan app shell. |

**Interaksi Utama:**

1. Klik message → SCR-4 Message Detail pada mailbox yang sama.
2. Star/unstar dan read/unread → update Dexie optimistic + enqueue mutation.
3. Move → pilih folder tujuan dalam mailbox yang sama; update optimistic + queue.
4. Trash → gunakan move ke system folder Trash.
5. Search umum mencari `from OR to OR subject`; prefix mendukung `from:`, `to:`, `subject:`.
6. Pagination message menggunakan cursor, default 10 per batch.
7. Mailbox Switcher membuka pilihan mailbox. Saat target dipilih, navigasi ke route target, buka Dexie target, render local projection, lalu delta sync background.
8. Queue mailbox lama tidak ikut diproses dalam scope mailbox baru.
9. Pada mobile, sidebar/folder navigation menjadi Drawer/Sheet.

**Referensi Visual:** Material Design 3-inspired webmail dari `DESIGN.md`; tanpa Compose button.

---

## 6.4 SCR-4 — Message Detail

**Tujuan:** Menampilkan isi raw email secara aman dan memberi akses pada mutation yang relevan.

**Komponen di screen ini:**

- Page Header
- Message Toolbar
- Surface Container
- Remote Image Notice
- Skeleton
- Alert / Inline Message
- Dialog
- Error State

**State:**

| **State**             | **Kondisi Muncul**                              | **Tampilan/Perilaku**                                                                                                     |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Default               | `.eml` berhasil diperoleh dan diparse           | Tampilkan sender, recipient, subject, date, sanitized HTML/text body dan attachment metadata yang dapat diperoleh parser. |
| Loading               | Cache miss dan raw sedang di-fetch / parse      | Detail skeleton; metadata lokal dapat tetap terlihat lebih dulu.                                                          |
| Empty                 | Body email kosong setelah parsing               | Metadata tetap ditampilkan, body area memberi keterangan tidak ada content.                                               |
| Error                 | Raw fetch gagal                                 | Error state dengan Retry.                                                                                                 |
| Parsing Error         | `.eml` tersedia tetapi parsing gagal            | Tampilkan parsing error; raw tetap dipertahankan di cache sesuai behavior teknis.                                         |
| Remote Images Blocked | HTML memiliki remote image yang belum diizinkan | Banner menjelaskan gambar eksternal diblokir dan menyediakan action **Load images**.                                      |
| Remote Images Loading | User memilih Load images                        | Banner/action masuk loading state sambil resource message tersebut diaktifkan.                                            |
| Remote Images Loaded  | Remote image diizinkan untuk message aktif      | Render resource remote untuk message ini saja; tidak membuat whitelist sender/domain.                                     |
| Pending Mutation      | Read/star/move masih queued                     | UI optimistic tetap terlihat dengan pending indicator ringan.                                                             |

**Interaksi Utama:**

1. Saat buka detail, cek Browser Cache API untuk raw `.eml`.
2. Cache miss → fetch raw melalui Worker, simpan ke Cache API, parse dengan `postal-mime`.
3. Render HTML hanya setelah sanitization.
4. Remote image blocked default; user dapat memilih Load images untuk message yang sedang dibuka saja.
5. Read/unread, star/unstar, move mengikuti optimistic queue.
6. Permanent Delete hanya tersedia bila message berada di Trash dan wajib melalui destructive confirmation.
7. Back kembali ke folder/list mailbox yang sama.

**Referensi Visual:** main reading surface putih pada canvas gray-blue, toolbar compact, remote-image banner berbasis shadcn-vue alert.

---

## 6.5 SCR-5 — Folder Management

**Tujuan:** Mengelola custom folder dalam mailbox aktif tanpa mengizinkan modifikasi system folder.

**Komponen di screen ini:**

- App Shell
- Mailbox Switcher
- Page Header
- Data Table / list
- Badge / Status Chip
- Button
- Dialog / Sheet
- Form Field
- Text Input
- Alert / Inline Message
- Empty State
- Error State

**State:**

| **State**        | **Kondisi Muncul**                            | **Tampilan/Perilaku**                                                           |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Default          | Folder berhasil dimuat                        | System dan custom folder dibedakan; system folder tidak memiliki rename/delete. |
| Loading          | Folder sedang dimuat atau mutation berjalan   | Skeleton/disabled actions sesuai scope.                                         |
| Empty            | Tidak ada custom folder                       | System folder tetap tampil; empty hint untuk custom folder.                     |
| Error            | Fetch/create/delete gagal                     | Inline/full error dan Retry bila sesuai.                                        |
| Validation Error | Nama duplicate case-insensitive atau reserved | Field-level error; form tetap terbuka.                                          |

**Interaksi Utama:**

1. Create custom folder melalui Dialog/Sheet.
2. Delete custom folder memerlukan confirmation.
3. Setelah delete, message dalam folder dipindahkan ke Inbox oleh backend.
4. Ruleset yang mereferensikan folder terhapus dapat menjadi disabled/warning dan diperbaiki dari Ruleset Editor.

**Referensi Visual:** management list sederhana berbasis Surface Container.

---

## 6.6 SCR-6 — Ruleset List

**Tujuan:** Menampilkan dan mengelola ruleset mailbox berdasarkan numeric priority.

**Komponen di screen ini:**

- App Shell
- Mailbox Switcher
- Page Header
- Data Table / list
- Badge / Status Chip
- Pagination Control
- Button
- Icon Button
- Switch
- Dialog
- Skeleton
- Empty State
- Error State

**State:**

| **State**          | **Kondisi Muncul**                                     | **Tampilan/Perilaku**                                                                                                |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Default            | Ruleset batch tersedia                                 | Tampilkan name, numeric priority, logic operator, enabled state dan action edit/delete. Urut sesuai contract server. |
| Loading            | Initial fetch / pindah batch / mutation                | Skeleton row atau per-control loading.                                                                               |
| Empty              | Tidak ada ruleset pada mailbox                         | Empty state dengan Create Ruleset.                                                                                   |
| Error              | Fetch/mutation gagal                                   | Error state dengan Retry / rollback control state.                                                                   |
| Invalid Dependency | Ruleset dinonaktifkan karena folder action tidak valid | Warning badge/inline hint; user diarahkan edit ruleset.                                                              |
| Paginated          | Ada cursor berikutnya/sebelumnya                       | Pagination Control default 10 ruleset per batch.                                                                     |

**Interaksi Utama:**

1. Create → SCR-7 Ruleset Editor mode create.
2. Edit → SCR-7 mode edit.
3. Delete → confirmation Dialog.
4. Toggle enabled hanya jika ruleset valid.
5. **Tidak ada drag-and-drop antar-ruleset pada MVP.** Priority ditentukan oleh angka eksplisit di editor.
6. Pagination menggunakan cursor 10/batch.

**Referensi Visual:** admin-like list dengan numeric priority column dan tonal status badges.

---

## 6.7 SCR-7 — Ruleset Editor

**Tujuan:** Membuat atau mengubah ruleset, conditions, ordered actions, logic operator, numeric priority, dan enabled state secara atomic.

**Komponen di screen ini:**

- Page Header
- Surface Container
- Form Field
- Text Input
- Number Input
- Select / Combobox
- Switch
- Rule Builder
- Rule Condition Row
- Rule Action Row
- Reorder Controls
- Button
- Alert / Inline Message

**State:**

| **State**        | **Kondisi Muncul**                                                       | **Tampilan/Perilaku**                                                                                                         |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Default          | Form siap digunakan                                                      | Name, numeric priority, AND/OR, enabled, conditions dan actions tampil.                                                       |
| Loading          | Detail ruleset sedang di-fetch atau save berjalan                        | Skeleton/form disabled sesuai scope.                                                                                          |
| Empty            | Ruleset baru belum memiliki row lengkap                                  | Editor tetap memberi minimal satu condition dan satu action sebagai baseline atau menampilkan add action sesuai implementasi. |
| Error            | Fetch/save gagal                                                         | Form input dipertahankan; tampilkan error dan Retry/save ulang.                                                               |
| Validation Error | Required field, invalid regex, invalid folder/action, atau order invalid | Field/row-level error; submit diblokir.                                                                                       |
| Reordering       | User drag atau menekan Up/Down                                           | Row berubah posisi; urutan visual menjadi sumber `condition_order` / `action_order` saat save.                                |

**Interaksi Utama:**

1. Isi name.
2. Isi **priority sebagai integer eksplisit**; angka lebih kecil dieksekusi lebih dahulu dan gap diperbolehkan.
3. Pilih satu `logic_operator`: AND atau OR untuk seluruh condition.
4. Tambah condition dengan field `from`, `subject`, atau `header`.
5. Pilih match type: contains, not contains, equal, not equal, start with, end with, match regex.
6. Regex invalid ditolak sebelum save selesai.
7. Tambah action: `move_to_folder`, `mark_as_star`, atau `mark_as_read`.
8. Reorder condition/action menggunakan **drag-and-drop dan tombol Up/Down**. Drag handle bukan satu-satunya mekanisme reorder.
9. Untuk action move, destination harus folder mailbox aktif.
10. Jika beberapa move action ada, helper text menjelaskan bahwa move terakhir menentukan folder final.
11. Save mengirim ordered arrays final; tidak ada endpoint reorder terpisah.
12. Cancel/back kembali ke Ruleset List.

**Referensi Visual:** form builder modular dengan row surface ringan dan drag handle Lucide.

---

## 6.8 SCR-8 — Account / Change Password

**Tujuan:** Memungkinkan user mengganti password sendiri dan logout current session.

**Komponen di screen ini:**

- App Shell / account layout
- Page Header
- Surface Container
- Form Field
- Password Input
- Button
- Alert / Inline Message
- Dialog

**State:**

| **State** | **Kondisi Muncul**               | **Tampilan/Perilaku**                                                             |
| --------- | -------------------------------- | --------------------------------------------------------------------------------- |
| Default   | Account screen terbuka           | Form change password dan action logout tersedia.                                  |
| Loading   | Change password/logout berjalan  | Button loading; prevent double submit.                                            |
| Empty     | Password field belum diisi       | Required state sesuai interaction.                                                |
| Error     | Password invalid / request gagal | Field-level atau inline error.                                                    |
| Success   | Password berhasil diganti        | Informasikan bahwa user perlu autentikasi kembali karena refresh tokens direvoke. |

**Interaksi Utama:**

1. Change password dengan panjang 8–128 karakter.
2. Success → clear local session/storage sesuai flow lalu arahkan Login.
3. Logout → revoke current session saja, clear token + seluruh Dexie/Cache API user/session pada perangkat, lalu Login.
4. Tidak ada “logout all devices” sebagai fitur terpisah pada MVP.

**Referensi Visual:** account settings form minimal.

---

## 6.9 SCR-9 — User Management

**Tujuan:** Memungkinkan admin membuat dan mengubah user Runmail tanpa hard delete.

**Komponen di screen ini:**

- Admin App Shell
- Page Header
- Data Table / Admin List
- Pagination Control
- Badge / Status Chip
- Button
- Dialog / Sheet
- Form Field
- Text Input
- Password Input
- Select / Combobox
- Switch
- Skeleton
- Empty State
- Error State

**State:**

| **State** | **Kondisi Muncul**                     | **Tampilan/Perilaku**                                    |
| --------- | -------------------------------------- | -------------------------------------------------------- |
| Default   | User batch tersedia                    | Tampilkan username, role, active status dan edit action. |
| Loading   | Initial fetch / pindah page / mutation | Skeleton list atau loading pada dialog.                  |
| Empty     | Belum ada user yang dapat ditampilkan  | Empty state; Create Member tetap tersedia.               |
| Error     | Fetch/create/update gagal              | Error state atau field-level error sesuai contract.      |
| Paginated | Ada cursor berikutnya/sebelumnya       | Pagination Control 10 user per batch.                    |

**Interaksi Utama:**

1. Create member melalui form admin; tidak ada self-registration.
2. Update role/status/password.
3. Deactivate user melalui explicit control/confirmation; backend me-revoke refresh token user.
4. Tidak ada hard delete.
5. Pagination cursor 10/batch.

**Referensi Visual:** responsive admin table/list.

---

## 6.10 SCR-10 — Domain Management

**Tujuan:** Memungkinkan admin menambahkan domain Cloudflare dan memantau verification state sebelum domain dipakai untuk mailbox.

**Komponen di screen ini:**

- Admin App Shell
- Page Header
- Data Table / Admin List
- Pagination Control
- Badge / Status Chip
- Button
- Dialog / Sheet
- Select / Combobox
- Alert / Inline Message
- Skeleton
- Empty State
- Error State

**State:**

| **State**            | **Kondisi Muncul**                          | **Tampilan/Perilaku**                                                                         |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Default              | Domain batch tersedia                       | Domain name + `active` / `pending_verification` status.                                       |
| Loading              | Fetch available/domain list/verify berjalan | Skeleton atau per-row loading.                                                                |
| Empty                | Belum ada domain Runmail                    | Empty state dengan Add Domain.                                                                |
| Error                | Fetch/add/verify gagal                      | Error state dengan Retry.                                                                     |
| Pending Verification | Domain belum lolos verification             | Warning chip + Verify/Re-check action. Jangan invent detail DNS yang belum dikunci Tech Plan. |
| Paginated            | Ada cursor page lain                        | Pagination Control 10 domain per batch.                                                       |

**Interaksi Utama:**

1. Add Domain memilih dari domain Cloudflare yang tersedia bagi sistem.
2. Domain baru berstatus pending verification.
3. Re-check verification melalui action eksplisit.
4. Domain pending tidak dapat digunakan ketika create mailbox.
5. Pagination cursor 10/batch.

**Referensi Visual:** management list + status chip warning/success.

---

## 6.11 SCR-11 — Mailbox Management

**Tujuan:** Memungkinkan admin membuat, mengubah status, dan mengelola user assignment pada mailbox.

**Komponen di screen ini:**

- Admin App Shell
- Page Header
- Data Table / Admin List
- Pagination Control
- Badge / Status Chip
- Button
- Dialog / Sheet
- Form Field
- Text Input
- Select / Combobox
- Switch
- Alert / Inline Message
- Skeleton
- Empty State
- Error State

**State:**

| **State**         | **Kondisi Muncul**                                     | **Tampilan/Perilaku**                                                                                          |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Default           | Mailbox batch tersedia                                 | Tampilkan address (`local_part@domain`), status, dan management action.                                        |
| Loading           | Initial fetch / pindah page / create/update            | Skeleton/list loading atau form loading.                                                                       |
| Empty             | Belum ada mailbox                                      | Empty state dengan Create Mailbox.                                                                             |
| Error             | Fetch/update gagal                                     | Error state sesuai scope.                                                                                      |
| No Active Domain  | Create mailbox dibuka tetapi tidak ada domain active   | Form create diblokir/disabled dengan pesan agar domain diaktifkan dulu.                                        |
| Duplicate Address | Backend mengembalikan duplicate `(domain, local_part)` | Form tetap terbuka; input dipertahankan; tampilkan **field-level error pada `local_part`**, bukan hanya toast. |
| Paginated         | Ada cursor page lain                                   | Pagination Control 10 mailbox per batch.                                                                       |

**Interaksi Utama:**

1. Create mailbox memilih domain `active` dan mengisi local-part.
2. Submit duplicate address menampilkan field-level error seperti “Alamat email ini sudah digunakan.” pada local-part.
3. Activate/deactivate mailbox melalui explicit status control/confirmation.
4. Manage assignment user ke mailbox.
5. Seluruh user yang terhubung memiliki hak mailbox yang sama dalam MVP; tidak ada mailbox-level role berbeda.
6. Tidak ada hard delete mailbox.
7. Pagination cursor 10/batch.

**Referensi Visual:** responsive admin list/form, field error mengikuti shadcn-vue Form Field.

# 7. Alur Navigasi (Flow Diagram)

```text
ENTRY
  |
  v
SCR-1 Login
  |
  +-- login gagal ------------------------> tetap SCR-1
  |
  +-- tepat 1 mailbox + has_more=false
  |        |
  |        v
  |   /mailboxes/:mailboxId/inbox
  |        |
  |        v
  |      SCR-3 Inbox
  |
  +-- multiple / paginated mailboxes
           |
           v
      SCR-2 Mailbox Selection
           |
           | pilih mailbox
           v
   /mailboxes/:mailboxId/inbox
           |
           v
      SCR-3 Inbox / Folder Message List
           |
           +-- pilih message -------------> SCR-4 Message Detail
           |                                  |
           |                                  +--> Back -> SCR-3 mailbox/folder yang sama
           |
           +-- Manage Folders ------------> SCR-5 Folder Management
           |
           +-- Rulesets -------------------> SCR-6 Ruleset List
           |                                  |
           |                                  +-- Create/Edit -> SCR-7 Ruleset Editor
           |                                                       |
           |                                                       +-- Save/Cancel -> SCR-6
           |
           +-- Switch Mailbox -------------> SCR-2 Mailbox Selection
           |                                  |
           |                                  +-- target dipilih
           |                                      -> route target
           |                                      -> open Dexie target
           |                                      -> render local projection
           |                                      -> delta sync background
           |
           +-- User Menu -------------------> SCR-8 Account
           |                                  |
           |                                  +-- Logout -> SCR-1
           |
           +-- Admin Navigation (admin only)
                 |
                 +--> SCR-9 User Management
                 +--> SCR-10 Domain Management
                 +--> SCR-11 Mailbox Management

ROUTE GUARD:
/mailboxes/:mailboxId/*
  |
  +-- mailbox valid + accessible + active --> continue
  |
  +-- invalid / inaccessible / inactive ----> SCR-2 atau mailbox valid lain

MOBILE:
- Sidebar/folder/admin navigation -> Drawer/Sheet
- Message selection -> full-screen SCR-4
- Small create/edit forms -> Dialog atau Sheet sesuai viewport
```

# 8. Aksesibilitas & Responsivitas

- **Target Device:** Responsive web untuk browser modern desktop dan mobile.
- **Desktop Layout:** Multi-panel dashboard dengan navigation persistent dan main surface dominan.
- **Mobile Layout:** Navigation menjadi Drawer/Sheet; message detail menggunakan full-screen reading flow.
- **Keyboard Navigation:** Semua button, input, select, row action, pagination, dan dialog dapat dioperasikan keyboard.
- **Reorder Ruleset:** Condition/action tidak boleh hanya bergantung drag-and-drop; tombol Up/Down wajib tersedia untuk keyboard/mobile.
- **Focus State:** Focus indicator terlihat jelas dan tidak hanya bergantung perubahan warna yang terlalu halus.
- **Dialog/Drawer Focus:** Focus trap dan focus return diterapkan ketika overlay ditutup.
- **Tap Target:** Interactive target mobile diarahkan sekitar 44×44px atau area sentuh ekuivalen.
- **Status Representation:** Active/inactive/pending/error tidak disampaikan hanya melalui warna; gunakan label/icon/copy.
- **Unread Message:** Dibedakan minimal melalui weight 700 selain warna.
- **Icon-only Action:** Wajib accessible label dan tooltip bila konteks tidak cukup jelas.
- **Form Error:** Validation error ditampilkan pada field terkait; jangan hanya menggunakan toast.
- **Pagination:** Previous/Next memiliki disabled/loading states yang dapat dikenali screen reader dan keyboard.
- **Long Content:** Email address, subject, folder name, domain dan mailbox address menggunakan truncation/wrap yang tidak memotong fungsi utama.
- **Loading Stability:** Skeleton mempertahankan struktur agar layout shift besar dihindari.
- **Reduced Motion:** Animasi/transisi non-esensial menghormati `prefers-reduced-motion`.
- **Email HTML Isolation:** Sanitized content tidak boleh merusak styling/layout aplikasi; remote resources diblokir sampai user mengizinkan message aktif.
- **Destructive Action:** Permanent delete dan destructive admin actions memiliki confirmation yang eksplisit dan focus-safe.

# 9. Pertanyaan Terbuka / TBD

- Apakah palette pada `DESIGN.md` sudah final sebagai brand palette atau masih mood/reference palette?
- Logo/wordmark Runmail final belum tersedia.
- Font final belum dikunci: Roboto atau Inter.
- Warna error belum didefinisikan oleh `DESIGN.md`; draft menggunakan `#B3261E`.
- Bahasa utama UI produk belum dinyatakan eksplisit di PRD; spec menggunakan Bahasa Indonesia sebagai draft.
- Detail exact copy/status Cloudflare Email Routing/DNS verification menunggu keputusan teknis final pada Tech Plan.
- Apakah User Management membutuhkan client-side search/filter belum menjadi requirement PRD; jangan ditambahkan sebagai requirement MVP tanpa keputusan baru.
- Nama domain utama SaaS Runmail dan konfigurasi brand/domain operasional masih TBD pada PRD/Tech Plan.

**Keputusan yang sudah final dan bukan lagi TBD pada v0.2:**

- Single mailbox setelah login di-auto-select bila page pertama berisi tepat satu mailbox dan `has_more = false`.
- Mailbox aktif menjadi bagian eksplisit route `/mailboxes/:mailboxId/...`.
- Mailbox switching membuka local projection target terlebih dahulu lalu delta sync berjalan di background.
- Management list `users`, `domains`, `mailboxes`, `rulesets` menggunakan cursor pagination 10 item/batch.
- Ruleset priority menggunakan angka eksplisit, bukan drag-and-drop antar-ruleset.
- Condition/action reorder menggunakan drag-and-drop + Up/Down.
- Remote images dapat dimuat atas aksi user hanya untuk message yang sedang dibuka; tidak ada sender/domain allowlist persisten.
- Duplicate mailbox address ditampilkan sebagai field-level error pada `local_part`.

---

_Dokumen ini merupakan draft sementara v0.2 dan dapat berubah seiring pembahasan lebih lanjut. Merujuk pada PRD Runmail v0.5, Tech Plan Runmail v0.5, dan DESIGN.md._
