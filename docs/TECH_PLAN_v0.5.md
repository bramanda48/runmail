# TECH PLAN / ARCHITECTURE DOCUMENT

## Runmail

**STATUS: DRAFT SEMENTARA**

|                   |                  |
| ----------------- | ---------------- |
| **Nama Produk**   | Runmail          |
| **Versi Dokumen** | v0.5             |
| **Disusun oleh**  | Pengembang       |
| **Dokumen Acuan** | PRD Runmail v0.5 |
| **Tanggal**       | 9 September 2026 |

---

# 1. Ringkasan Teknis (Overview)

Runmail dibangun sebagai responsive Single Page Application (SPA) berbasis Vue 3 dengan backend API dan email-processing layer berbasis Hono pada Cloudflare Workers. Arsitektur MVP menggunakan modular monolith agar autentikasi, user, domain, mailbox, email ingest, inbox, folder, ruleset, sinkronisasi, raw email, dan retention memiliki boundary kode yang jelas tetapi tetap sederhana untuk dikembangkan dan dideploy.

Frontend menggunakan shadcn-vue sebagai design system/component foundation di atas Tailwind CSS. Icon rendering menggunakan Iconify melalui `@iconify/vue` dengan satu icon set utama **Lucide** (`lucide:*`) agar style icon konsisten dengan visual language shadcn-vue. Cloudflare D1 menjadi source of truth metadata dan state server-side, Cloudflare R2 menyimpan raw RFC-822 `.eml`, dan setiap mailbox memiliki database Dexie/IndexedDB tersendiri sebagai local projection metadata, folder, sync state, dan persistent mutation queue. Raw `.eml` yang pernah dibuka disimpan pada Browser Cache API. Mailbox merupakan tenant boundary; tidak ada entitas tenant/workspace terpisah. Frontend routing menempatkan `mailbox_id` di URL untuk seluruh screen mailbox-scoped. Jika user hanya memiliki satu mailbox aktif yang dapat diakses, frontend langsung memilih mailbox tersebut setelah login; bila lebih dari satu, frontend menampilkan mailbox selection. Perpindahan mailbox membuka local projection mailbox target terlebih dahulu agar data lokal dapat ditampilkan segera, kemudian menjalankan delta sync di background.

# 2. Tech Stack

| **Layer**            | **Pilihan**                                                                                                                                   | **Alasan**                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**         | Vue 3, TypeScript, **shadcn-vue**, Tailwind CSS, **Iconify (`@iconify/vue`) + Lucide icon set**, Dexie.js/IndexedDB, Cache API, `postal-mime` | SPA responsif dengan design system konsisten, icon system tunggal, local projection, optimistic UI, local search, raw cache, dan MIME parsing client-side. |
| **Backend**          | Hono + TypeScript pada Cloudflare Workers                                                                                                     | Menangani HTTP API, inbound email handler, dan scheduled handler dalam runtime Cloudflare.                                                                 |
| **Runtime/Tooling**  | Bun                                                                                                                                           | Runtime/tooling pengembangan dan workspace monorepo.                                                                                                       |
| **Database Server**  | Cloudflare D1 + Drizzle ORM                                                                                                                   | Source of truth relasional dan migration terkontrol.                                                                                                       |
| **Database Client**  | Dexie.js di atas IndexedDB                                                                                                                    | Persistent local projection dan offline mutation queue per mailbox.                                                                                        |
| **Autentikasi**      | Bearer JWT HS256 + rotating refresh token                                                                                                     | Access token 15 menit; refresh token 30 hari; session dapat direvoke.                                                                                      |
| **Hosting/Deploy**   | Cloudflare Workers + Workers Static Assets                                                                                                    | Frontend dan backend berada dalam ekosistem Workers.                                                                                                       |
| **Penyimpanan File** | Cloudflare R2 + Browser Cache API                                                                                                             | R2 menyimpan raw RFC-822; Cache API menyimpan copy lokal best-effort.                                                                                      |

# 3. Asumsi Teknis & Batasan

- **Asumsi teknis:** codebase menggunakan TypeScript.
- **Asumsi teknis:** repository menggunakan monorepo.
- **Asumsi teknis:** frontend menggunakan **shadcn-vue** sebagai design system/component foundation.
- **Asumsi teknis:** styling komponen shadcn-vue menggunakan **Tailwind CSS** dan design tokens/CSS variables agar theme dapat dikontrol terpusat.
- **Asumsi teknis:** icon framework frontend menggunakan **Iconify `@iconify/vue`**.
- **Asumsi teknis:** icon UI Runmail menggunakan satu icon set utama **Lucide** dengan prefix `lucide:*`; pencampuran icon set lain dihindari agar stroke, proporsi, dan visual language konsisten.
- **Asumsi teknis:** icon tidak dipanggil dari sumber acak per halaman; nama icon dipusatkan melalui mapping/constant bila icon digunakan berulang agar refactor icon mudah.
- **Asumsi teknis:** primary key server menggunakan UUID v7.
- **Asumsi teknis:** timestamp D1 menggunakan INTEGER Unix timestamp milliseconds dalam UTC.
- **Asumsi teknis:** API menggunakan prefix `/api/v1`.
- **Asumsi teknis:** response API memakai envelope konsisten `data`/`meta`; error memakai `error.code` dan `error.message`.
- **Asumsi teknis:** payload API divalidasi pada request boundary.
- **Asumsi teknis:** `sync_version` monotonik pada scope mailbox.
- **Asumsi teknis:** inbound metadata diparse menggunakan library MIME/email yang kompatibel dengan Workers; library final dapat dipilih melalui benchmark implementasi.
- **Asumsi teknis:** frontend route mailbox-scoped menggunakan `mailbox_id` eksplisit pada URL; mailbox aktif tidak hanya disimpan sebagai implicit global state.
- **Asumsi teknis:** setelah login, frontend mengambil halaman pertama daftar mailbox; jika hanya ada satu mailbox dan `has_more = false`, mailbox tersebut di-auto-select dan user langsung diarahkan ke Inbox.
- **Asumsi teknis:** hanya mailbox aktif yang menjalankan lifecycle delta sync; pending `sync_queue` mailbox lain tetap persisten di Dexie masing-masing dan diproses kembali saat mailbox tersebut menjadi aktif.
- **Asumsi teknis:** list management `users`, `domains`, `mailboxes`, dan `rulesets` menggunakan opaque cursor pagination dengan default 10 item per batch.
- **Asumsi teknis:** `ruleset.priority` diinput user sebagai angka eksplisit; angka lebih kecil dieksekusi lebih dahulu dan gap diperbolehkan.
- **Asumsi teknis:** UI Ruleset Editor mendukung reorder condition/action melalui drag-and-drop serta kontrol Up/Down; saat save frontend mengirim urutan final sebagai `condition_order` dan `action_order`.
- **Asumsi teknis:** izin memuat remote image hanya berlaku untuk message yang sedang dibuka dan tidak membuat whitelist sender/domain persisten.
- **Asumsi teknis:** duplicate `(domain, local_part)` dikembalikan backend sebagai validation error terstruktur agar frontend dapat menampilkan field-level error pada `local_part`.
- **Batasan:** raw email maksimum 25 MB termasuk attachment.
- **Batasan:** message hanya dapat dipindahkan antar-folder dalam mailbox yang sama.
- **Batasan:** search MVP hanya terhadap metadata lokal, bukan body email.
- **Batasan:** ruleset tidak disimpan di Dexie.
- **Batasan:** tidak ada application-level login rate limiting pada MVP.
- **Batasan:** tidak ada hard delete mailbox dan user; keduanya menggunakan deactivate.
- **Batasan:** raw RFC-822 tidak dimodifikasi dan tidak mendapat enkripsi aplikasi tambahan di atas storage Cloudflare.

# 4. Arsitektur Sistem

Frontend Vue 3 menggunakan shadcn-vue untuk primitive/component UI dan Tailwind CSS untuk styling serta design tokens. Icon di-render melalui `@iconify/vue` dengan Lucide sebagai icon set utama. UI melakukan autentikasi melalui Bearer JWT lalu mengambil daftar mailbox yang dapat diakses dengan pagination 10/batch. Jika hanya satu mailbox tersedia dan response menyatakan tidak ada page berikutnya, frontend auto-select mailbox tersebut dan langsung masuk Inbox; jika lebih dari satu, frontend menampilkan mailbox selection. Seluruh route mailbox-scoped membawa `mailbox_id` pada URL. Setelah mailbox aktif ditentukan, frontend membuka database Dexie khusus mailbox tersebut, menampilkan local projection yang tersedia, lalu menjalankan delta sync di background. Perubahan read/unread, star/unstar, dan move diterapkan secara optimistic, ditulis ke `sync_queue`, lalu dikirim ke backend secara batch FIFO. Hanya mailbox aktif yang menjalankan sync lifecycle; queue mailbox lain tetap persisten dan tidak ikut diproses dalam scope mailbox aktif.

Inbound email diterima Cloudflare Email Routing. Worker menentukan mailbox berdasarkan `(domain, local_part)`, memvalidasi domain/mailbox, ukuran, dan ruleset, lalu menyimpan raw RFC-822 ke R2 terlebih dahulu dan metadata/state ke D1. Jika R2 berhasil tetapi D1 gagal, Worker menghapus object R2 tersebut dan me-reject email dengan reason agar sender mengirim ulang.

Saat detail message dibuka, frontend mengecek Cache API. Jika raw belum tersedia, frontend mengambilnya melalui Worker dari R2, menyimpannya ke Cache API, lalu memparse dengan `postal-mime`. HTML disanitasi sebelum render dan remote images diblokir secara default. User dapat memilih memuat remote images untuk message yang sedang dibuka; izin tersebut tidak membuat whitelist persisten untuk sender/domain dan tidak menjadi preference global. Scheduled handler melakukan cleanup Trash/Spam dan pruning sync history.

```text
Inbound Email
     |
     v
Cloudflare Email Routing
     |
     v
Email Worker / Hono
   |             |
   | metadata    | raw RFC-822
   v             v
Cloudflare D1   Cloudflare R2
   ^
   |
Hono HTTP API
   ^
   | HTTPS + Authorization: Bearer <JWT>
   v
Vue 3 SPA
   |
   +--> shadcn-vue + Tailwind CSS
   |
   +--> Iconify (@iconify/vue)
   |      \--> Lucide icon set (lucide:*)
   |
   +--> Dexie/IndexedDB (per mailbox)
   |      metadata + folders + sync state + queue
   |
   \--> Cache API
          raw .eml
```

## 4.1 Frontend Routing & Mailbox Lifecycle

Route utama SPA menggunakan pola berikut:

```text
/login
/mailboxes
/mailboxes/:mailbox_id/inbox
/mailboxes/:mailbox_id/folders/:folder_id
/mailboxes/:mailbox_id/messages/:message_id
/mailboxes/:mailbox_id/folders
/mailboxes/:mailbox_id/rulesets
/mailboxes/:mailbox_id/rulesets/:ruleset_id
/account
/admin/users
/admin/domains
/admin/mailboxes
```

Route guard memvalidasi authentication terlebih dahulu. Route yang membawa `:mailbox_id` juga memvalidasi bahwa mailbox ada pada daftar akses user dan berstatus aktif. URL menjadi source untuk mailbox context pada navigasi/deep-link, sedangkan store frontend menyimpan resolved mailbox state untuk kebutuhan runtime.

Lifecycle pemilihan/switch mailbox:

1. Setelah login, frontend fetch `GET /api/v1/mailboxes` page pertama.
2. Jika response berisi tepat satu mailbox dan `meta.has_more = false`, frontend langsung membuka route Inbox mailbox tersebut.
3. Jika tersedia lebih dari satu mailbox, frontend membuka `/mailboxes` dan user memilih mailbox.
4. Saat mailbox dipilih/switch, frontend menghentikan active sync lifecycle mailbox sebelumnya tanpa menghapus database atau pending queue-nya.
5. Frontend membuka Dexie database mailbox target dan segera merender local projection yang tersedia.
6. Frontend menjalankan delta sync mailbox target di background dan menerapkan hasilnya ke Dexie/UI.
7. Pending mutation queue hanya diproses untuk mailbox yang sedang aktif. Queue mailbox lain tetap persistent hingga mailbox tersebut aktif kembali.

Mailbox inactive tidak boleh dibuka. Jika route mengarah ke mailbox yang sudah tidak accessible/inactive, frontend kembali ke mailbox selection atau mailbox aktif lain yang valid.

# 5. Struktur Proyek (Folder Structure)

> Catatan implementasi (gate #5 R2): kode aktual memakai konvensi `src/views/` + `src/router/` sebagai pengganti `src/features/` + `src/routes/` pada diagram di bawah — tidak ada perubahan makna struktur selain penamaan tersebut.

```text
runmail/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── ui/              # generated/adapted shadcn-vue components
│   │       │   └── app/             # Runmail-specific reusable components
│   │       ├── features/
│   │       ├── routes/
│   │       ├── stores/
│   │       ├── db/
│   │       ├── sync/
│   │       ├── cache/
│   │       ├── icons/
│   │       │   └── index.ts         # optional centralized icon-name mapping
│   │       ├── styles/
│   │       │   └── globals.css      # Tailwind + shadcn-vue design tokens
│   │       └── lib/
│   └── worker/
│       └── src/
│           ├── modules/
│           │   ├── auth/
│           │   ├── users/
│           │   ├── domains/
│           │   ├── mailboxes/
│           │   ├── mail/
│           │   ├── inbox/
│           │   ├── folders/
│           │   ├── rulesets/
│           │   ├── sync/
│           │   └── retention/
│           ├── middleware/
│           ├── email/
│           └── scheduled/
├── packages/
│   ├── db/
│   │   ├── schema/
│   │   └── migrations/
│   └── shared/
│       ├── contracts/
│       ├── validation/
│       └── types/
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

# 6. Modul Teknis & Pemetaan ke Kebutuhan Fungsional

| **ID**      | **Modul Teknis**                                                                          | **Terkait FR (PRD)**                     | **Kompleksitas** |
| ----------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------- |
| **AUTH-T1** | Authentication, JWT, refresh rotation, password management                                | AUTH-1–AUTH-11                           | Tinggi           |
| **USER-T1** | User management dan activation state                                                      | USER-1–USER-4                            | Sedang           |
| **DOMN-T1** | Domain discovery dan verification state                                                   | DOMN-1–DOMN-6                            | Tinggi           |
| **MBX-T1**  | Mailbox management dan authorization                                                      | MBX-1–MBX-10                             | Tinggi           |
| **MAIL-T1** | Inbound email routing, parsing, ruleset, persistence                                      | MAIL-1–MAIL-9                            | Tinggi           |
| **INBX-T1** | Inbox listing dan message state mutation                                                  | INBX-1–INBX-8                            | Sedang           |
| **FOLD-T1** | System/custom folder dan move                                                             | FOLD-1–FOLD-8                            | Sedang           |
| **RULE-T1** | Ruleset CRUD, matcher, priority, ordered actions                                          | RULE-1–RULE-17                           | Tinggi           |
| **SYNC-T1** | Delta sync, event history, full resync                                                    | SYNC-1–SYNC-12                           | Tinggi           |
| **OPTI-T1** | Dexie optimistic state dan persistent queue                                               | OPTI-1–OPTI-4                            | Tinggi           |
| **EML-T1**  | Raw retrieval, Cache API, MIME parsing/rendering                                          | EML-1–EML-7                              | Sedang           |
| **SRCH-T1** | Local metadata search dan pagination                                                      | SRCH-1–SRCH-7                            | Sedang           |
| **RETN-T1** | Trash/Spam retention dan scheduled cleanup                                                | RETN-1–RETN-10                           | Sedang           |
| **UI-T1**   | shadcn-vue component system, design tokens, responsive layout, Iconify/Lucide integration | NFR Responsive UI + seluruh UI-facing FR | Sedang           |

# 7. Skema Database & Local Storage

## 7.1 Cloudflare D1 — Server-Side Source of Truth

Seluruh ID menggunakan UUID v7. Timestamp menggunakan Unix timestamp milliseconds UTC.

### 7.1.1 `users`

| **Field**       | **Tipe** | **Keterangan**                                 |
| --------------- | -------- | ---------------------------------------------- |
| `id`            | TEXT     | Primary key UUID v7.                           |
| `username`      | TEXT     | Unique global; regex `[A-Za-z0-9\-_\.]{6,20}`. |
| `password_hash` | TEXT     | Bcrypt password hash.                          |
| `role`          | TEXT     | `admin` atau `member`.                         |
| `is_active`     | INTEGER  | Boolean 0/1.                                   |
| `created_at`    | INTEGER  | Unix ms UTC.                                   |
| `updated_at`    | INTEGER  | Unix ms UTC.                                   |

**Constraint:** `UNIQUE(username)`.

### 7.1.2 `domains`

| **Field**             | **Tipe** | **Keterangan**                             |
| --------------------- | -------- | ------------------------------------------ |
| `id`                  | TEXT     | Primary key.                               |
| `domain_name`         | TEXT     | Domain yang tersedia pada akun Cloudflare. |
| `verification_status` | TEXT     | `pending_verification` atau `active`.      |
| `created_at`          | INTEGER  | Unix ms UTC.                               |
| `updated_at`          | INTEGER  | Unix ms UTC.                               |

**Constraint:** `UNIQUE(domain_name)`.

Domain yang tidak lagi memenuhi verification akan kembali menjadi `pending_verification`.

### 7.1.3 `mailboxes`

| **Field**    | **Tipe** | **Keterangan**                             |
| ------------ | -------- | ------------------------------------------ |
| `id`         | TEXT     | Primary key sekaligus tenant identifier.   |
| `domain_id`  | TEXT     | FK `domains.id`.                           |
| `local_part` | TEXT     | Local-part sesuai aturan RFC yang berlaku. |
| `is_active`  | INTEGER  | Boolean 0/1.                               |
| `created_at` | INTEGER  | Unix ms UTC.                               |
| `updated_at` | INTEGER  | Unix ms UTC.                               |

**Constraint:** `UNIQUE(domain_id, local_part)`.

Mailbox tidak di-hard-delete. Mailbox inactive tidak dapat dibuka user dan tidak menerima inbound email.

### 7.1.4 `mailbox_users`

| **Field**    | **Tipe** | **Keterangan**     |
| ------------ | -------- | ------------------ |
| `id`         | TEXT     | Primary key.       |
| `mailbox_id` | TEXT     | FK `mailboxes.id`. |
| `user_id`    | TEXT     | FK `users.id`.     |
| `created_at` | INTEGER  | Unix ms UTC.       |

**Constraint:** `UNIQUE(mailbox_id, user_id)`.

### 7.1.5 `folders`

| **Field**     | **Tipe** | **Keterangan**          |
| ------------- | -------- | ----------------------- |
| `id`          | TEXT     | Primary key.            |
| `mailbox_id`  | TEXT     | FK `mailboxes.id`.      |
| `name`        | TEXT     | Nama folder.            |
| `folder_type` | TEXT     | `system` atau `custom`. |
| `created_at`  | INTEGER  | Unix ms UTC.            |
| `updated_at`  | INTEGER  | Unix ms UTC.            |

System folder: `inbox`, `draft`, `sent`, `spam`, `archive`, `trash`. System folder permanen. Custom folder unique case-insensitive dalam mailbox.

### 7.1.6 `messages`

| **Field**             | **Tipe**     | **Keterangan**                                                     |
| --------------------- | ------------ | ------------------------------------------------------------------ |
| `id`                  | TEXT         | Primary key.                                                       |
| `mailbox_id`          | TEXT         | FK `mailboxes.id`.                                                 |
| `internet_message_id` | TEXT NULL    | Message-ID bila tersedia; tidak unique.                            |
| `from_name`           | TEXT NULL    | Display name sender.                                               |
| `from_address`        | TEXT         | Alamat sender.                                                     |
| `subject`             | TEXT         | Subject.                                                           |
| `snippet`             | TEXT         | Dibuat saat ingest dari text body yang dinormalisasi dan dipotong. |
| `email_date`          | INTEGER      | Date header; fallback ke `received_at` bila missing/invalid.       |
| `received_at`         | INTEGER      | Waktu diterima Runmail.                                            |
| `is_read`             | INTEGER      | Boolean 0/1.                                                       |
| `is_starred`          | INTEGER      | Boolean 0/1.                                                       |
| `folder_id`           | TEXT         | FK folder mailbox yang sama.                                       |
| `folder_entered_at`   | INTEGER NULL | Hanya diisi saat masuk Trash/Spam; `NULL` saat keluar.             |
| `raw_object_key`      | TEXT         | R2 key.                                                            |
| `sync_version`        | INTEGER      | Versi state terakhir dalam scope mailbox.                          |
| `updated_at`          | INTEGER      | Unix ms UTC.                                                       |

**Index:** `(mailbox_id, folder_id, email_date)`, `(mailbox_id, updated_at)`, `(mailbox_id, sync_version)`.

R2 key:

```text
mailboxes/<mailbox_id>/messages/<message_id>.eml
```

### 7.1.7 `message_recipients`

| **Field**        | **Tipe**  | **Keterangan**          |
| ---------------- | --------- | ----------------------- |
| `id`             | TEXT      | Primary key.            |
| `message_id`     | TEXT      | FK `messages.id`.       |
| `recipient_type` | TEXT      | `to`, `cc`, atau `bcc`. |
| `display_name`   | TEXT NULL | Display name recipient. |
| `email_address`  | TEXT      | Alamat recipient.       |

**Index:** `message_id`, `(message_id, recipient_type)`.

### 7.1.8 `rulesets`

| **Field**        | **Tipe** | **Keterangan**                                                                                      |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `id`             | TEXT     | Primary key.                                                                                        |
| `mailbox_id`     | TEXT     | FK mailbox.                                                                                         |
| `name`           | TEXT     | Nama ruleset.                                                                                       |
| `priority`       | INTEGER  | Diinput user sebagai angka eksplisit; angka lebih kecil dieksekusi lebih dahulu; gap diperbolehkan. |
| `logic_operator` | TEXT     | `AND` atau `OR`.                                                                                    |
| `is_enabled`     | INTEGER  | Boolean 0/1.                                                                                        |
| `created_at`     | INTEGER  | Unix ms UTC.                                                                                        |
| `updated_at`     | INTEGER  | Unix ms UTC.                                                                                        |

Ruleset wajib minimal satu condition dan satu action.

### 7.1.9 `ruleset_conditions`

| **Field**         | **Tipe** | **Keterangan**                                                                                         |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `id`              | TEXT     | Primary key.                                                                                           |
| `ruleset_id`      | TEXT     | FK ruleset.                                                                                            |
| `field`           | TEXT     | `from`, `subject`, `header`.                                                                           |
| `match_type`      | TEXT     | `contains`, `not contains`, `equal`, `not equal`, `start with`, `end with`, `match regex`.             |
| `condition_value` | TEXT     | Nilai pembanding/regex.                                                                                |
| `condition_order` | INTEGER  | Urutan condition final dari editor; frontend dapat mengubah urutan melalui drag-and-drop atau Up/Down. |

Non-regex case-insensitive. Regex mengikuti expression apa adanya dan divalidasi saat create/update.

### 7.1.10 `ruleset_actions`

| **Field**      | **Tipe**  | **Keterangan**                                                                                      |
| -------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `id`           | TEXT      | Primary key.                                                                                        |
| `ruleset_id`   | TEXT      | FK ruleset.                                                                                         |
| `action_type`  | TEXT      | `move_to_folder`, `mark_as_star`, `mark_as_read`.                                                   |
| `action_value` | TEXT NULL | Parameter action; folder ID untuk move.                                                             |
| `action_order` | INTEGER   | Urutan action final dari editor; frontend dapat mengubah urutan melalui drag-and-drop atau Up/Down. |

Destination move wajib folder pada mailbox yang sama. Jika custom folder yang direferensikan dihapus, ruleset terkait otomatis `is_enabled = 0`. Ruleset tidak dapat di-enable kembali sebelum action invalid diperbaiki. Jika satu action gagal saat runtime, action tersebut di-skip dan action berikutnya tetap dijalankan.

### 7.1.11 `sync_events`

| **Field**      | **Tipe** | **Keterangan**                                                            |
| -------------- | -------- | ------------------------------------------------------------------------- |
| `sync_version` | INTEGER  | Urutan monotonik per mailbox.                                             |
| `mailbox_id`   | TEXT     | FK mailbox.                                                               |
| `event_type`   | TEXT     | `message_created`, `message_updated`, `message_moved`, `message_deleted`. |
| `message_id`   | TEXT     | Message target.                                                           |
| `payload`      | TEXT     | Serialized event payload sesuai contract sync.                            |
| `created_at`   | INTEGER  | Unix ms UTC dan basis cursor/retention.                                   |

**Constraint:** `UNIQUE(mailbox_id, sync_version)`.

`message_created` membawa full metadata snapshot. Read/star memakai `message_updated` dengan `changes` partial patch. `message_moved` membawa `message_id`, `folder_id`, `sync_version`, timestamp. `message_deleted` membawa `message_id`, `sync_version`, timestamp.

### 7.1.12 `refresh_tokens`

| **Field**    | **Tipe**     | **Keterangan**           |
| ------------ | ------------ | ------------------------ |
| `id`         | TEXT         | Session/token record ID. |
| `user_id`    | TEXT         | FK user.                 |
| `token_hash` | TEXT         | Hash refresh token.      |
| `expires_at` | INTEGER      | Expiry 30 hari.          |
| `revoked_at` | INTEGER NULL | Revocation.              |
| `created_at` | INTEGER      | Unix ms UTC.             |

Rotasi me-revoke token lama. Reuse token lama ditolak tetapi tidak me-revoke seluruh token chain/session lain.

## 7.2 Dexie / IndexedDB — Local Projection Per Mailbox

Setiap mailbox memiliki satu database Dexie tersendiri. Ruleset tidak disimpan di Dexie.

### 7.2.1 `messages`

| **Field**      | **Tipe**    |
| -------------- | ----------- |
| `id`           | string      |
| `from_name`    | string/null |
| `from_address` | string      |
| `to_addresses` | string[]    |
| `subject`      | string      |
| `snippet`      | string      |
| `email_date`   | number      |
| `received_at`  | number      |
| `is_read`      | boolean     |
| `is_starred`   | boolean     |
| `folder_id`    | string      |
| `sync_version` | number      |
| `updated_at`   | number      |

Index utama: `&id`, `folder_id`, `email_date`, `[folder_id+email_date]`, `sync_version`, `updated_at`.

Search MVP melakukan scan/filter JavaScript case-insensitive pada `from_address`, `to_addresses`, dan `subject`.

### 7.2.2 `folders`

Field: `id`, `name`, `folder_type`, `updated_at`.

Index: `&id`, `folder_type`.

### 7.2.3 `sync_state`

Field: `id`, `last_sync_timestamp`, `latest_message_id`, `last_sync_version`, `last_full_sync_at`, `updated_at`.

Karena database sudah scoped per mailbox, `id` dapat berupa singleton key seperti `state`.

### 7.2.4 `sync_queue`

Field: `id`, `message_id`, `mutation_type`, `mutation_value`, `created_at`, `attempt_count`, `last_attempt_at`, `status`.

`id` adalah primary key lokal Dexie, bukan API idempotency key. Tidak ada backend dedupe/idempotency mechanism khusus untuk read/star/move.

Queue dikirim batch FIFO. Result backend dikembalikan per mutation. Definitive rejection satu mutation menyebabkan rollback mutation tersebut dan queue berikutnya tetap diproses.

## 7.3 Cloudflare R2

Raw object disimpan per mailbox/message walaupun satu inbound email memiliki beberapa recipient Runmail.

```text
mailboxes/<mailbox_id>/messages/<message_id>.eml
```

## 7.4 Browser Cache API

Raw `.eml` disimpan best-effort tanpa TTL aplikasi khusus. Browser boleh melakukan eviction karena storage pressure. Move folder tidak menghapus raw cache. Tombstone/permanent delete dan logout membersihkan raw yang relevan.

## 7.5 Mapping D1 ke Dexie

| **Server**                                      | **Dexie**                      | **Strategi**                                       |
| ----------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| `folders`                                       | `folders`                      | Local projection.                                  |
| `messages`                                      | `messages`                     | Metadata/state yang diperlukan UI.                 |
| `message_recipients`                            | `messages.to_addresses`        | Recipient `to` didenormalisasi untuk search.       |
| `sync_events`                                   | Tidak disimpan sebagai history | Event diterapkan; cursor disimpan di `sync_state`. |
| `rulesets`, conditions, actions                 | Tidak disimpan                 | Fetch API saat halaman ruleset dibuka.             |
| `users`, domains, mailbox_users, refresh_tokens | Tidak direplikasi              | Tetap authoritative server-side.                   |
| Client mutation                                 | `sync_queue`                   | Persistent local-only sampai sinkronisasi selesai. |

# 8. Desain API

Semua endpoint memakai `/api/v1`. Response sukses memakai `data` dan optional `meta`. Error memakai `error.code` dan `error.message`. Endpoint list yang dipaginate menggunakan opaque `cursor`, default `limit = 10`, dan mengembalikan metadata minimal `next_cursor` serta `has_more`. Message dan management list `users`, `domains`, `mailboxes`, dan `rulesets` menggunakan pola pagination ini.

## 8.1 Authentication

| **Method** | **Endpoint**            | **Deskripsi**                                                               | **Akses**     | **Terkait FR** |
| ---------- | ----------------------- | --------------------------------------------------------------------------- | ------------- | -------------- |
| POST       | `/auth/login`           | Login; return access + refresh token.                                       | Public        | AUTH-1–AUTH-5  |
| POST       | `/auth/refresh`         | Body berisi `refresh_token`; rotate dan return access + refresh token baru. | Refresh token | AUTH-3–AUTH-5  |
| POST       | `/auth/logout`          | Revoke current refresh token/session.                                       | Authenticated | AUTH-6–AUTH-8  |
| POST       | `/auth/change-password` | User mengganti password sendiri; revoke seluruh refresh token user.         | Authenticated | AUTH           |

## 8.2 User Management

| **Method** | **Endpoint**      | **Deskripsi**                                   | **Akses** | **Terkait FR** |
| ---------- | ----------------- | ----------------------------------------------- | --------- | -------------- |
| GET        | `/users`          | List user dengan opaque cursor; 10 per batch.   | Admin     | USER-1–USER-4  |
| POST       | `/users`          | Buat user dengan username dan initial password. | Admin     | USER-1–USER-4  |
| GET        | `/users/:user_id` | Detail user.                                    | Admin     | USER-1–USER-4  |
| PATCH      | `/users/:user_id` | Update role/status/password.                    | Admin     | USER-1–USER-4  |

User tidak memiliki endpoint hard delete. Deactivate langsung menolak akses dan me-revoke seluruh refresh token.

## 8.3 Domains

| **Method** | **Endpoint**                 | **Deskripsi**                                           | **Akses** | **Terkait FR** |
| ---------- | ---------------------------- | ------------------------------------------------------- | --------- | -------------- |
| GET        | `/domains/available`         | Domain yang tersedia dari Cloudflare.                   | Admin     | DOMN-1–DOMN-6  |
| GET        | `/domains`                   | List domain Runmail dengan opaque cursor; 10 per batch. | Admin     | DOMN-1–DOMN-6  |
| POST       | `/domains`                   | Tambah domain.                                          | Admin     | DOMN-1–DOMN-6  |
| POST       | `/domains/:domain_id/verify` | Re-check Email Routing/DNS verification.                | Admin     | DOMN-1–DOMN-6  |

## 8.4 Mailboxes

| **Method** | **Endpoint**                            | **Deskripsi**                                                       | **Akses**     | **Terkait FR** |
| ---------- | --------------------------------------- | ------------------------------------------------------------------- | ------------- | -------------- |
| GET        | `/mailboxes`                            | Mailbox yang dapat diakses user dengan opaque cursor; 10 per batch. | Authenticated | MBX-1–MBX-10   |
| POST       | `/mailboxes`                            | Buat mailbox pada domain active.                                    | Admin         | MBX-1–MBX-10   |
| GET        | `/mailboxes/:mailbox_id`                | Detail mailbox.                                                     | Mailbox user  | MBX-1–MBX-10   |
| PATCH      | `/mailboxes/:mailbox_id`                | Update/activate/deactivate mailbox.                                 | Admin         | MBX-1–MBX-10   |
| POST       | `/mailboxes/:mailbox_id/users`          | Hubungkan user.                                                     | Admin         | MBX-1–MBX-10   |
| DELETE     | `/mailboxes/:mailbox_id/users/:user_id` | Lepaskan user dari mailbox.                                         | Admin         | MBX-1–MBX-10   |

Tidak ada `DELETE /mailboxes/:mailbox_id`. Pada create mailbox, konflik `UNIQUE(domain_id, local_part)` dikembalikan sebagai validation error terstruktur dengan field `local_part` (misalnya `error.code = "MAILBOX_ADDRESS_ALREADY_EXISTS"`) agar UI dapat mempertahankan form dan menampilkan field-level error, bukan hanya generic toast.

## 8.5 Messages

| **Method** | **Endpoint**                                       | **Deskripsi**                                           | **Akses**    | **Terkait FR** |
| ---------- | -------------------------------------------------- | ------------------------------------------------------- | ------------ | -------------- |
| GET        | `/mailboxes/:mailbox_id/messages`                  | List metadata dengan opaque cursor; 10 per batch.       | Mailbox user | INBX/SRCH      |
| GET        | `/mailboxes/:mailbox_id/messages/:message_id`      | Metadata detail.                                        | Mailbox user | INBX           |
| GET        | `/mailboxes/:mailbox_id/messages/:message_id/raw`  | Stream/fetch raw `.eml` dari R2.                        | Mailbox user | EML            |
| PATCH      | `/mailboxes/:mailbox_id/messages/:message_id/read` | Read/unread.                                            | Mailbox user | INBX/OPTI      |
| PATCH      | `/mailboxes/:mailbox_id/messages/:message_id/star` | Star/unstar.                                            | Mailbox user | INBX/OPTI      |
| PATCH      | `/mailboxes/:mailbox_id/messages/:message_id/move` | Move dari folder mana pun ke folder lain dalam mailbox. | Mailbox user | INBX/FOLD/OPTI |
| DELETE     | `/mailboxes/:mailbox_id/messages/:message_id`      | Permanent delete bila message berada di Trash.          | Mailbox user | RETN           |

List sorting: `email_date DESC`, kemudian `message_id DESC`. Opaque cursor dapat mengenkode pasangan tersebut secara internal.

## 8.6 Folders

| **Method** | **Endpoint**                                | **Deskripsi**                                                         | **Akses**    | **Terkait FR** |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------- | ------------ | -------------- |
| GET        | `/mailboxes/:mailbox_id/folders`            | List folder.                                                          | Mailbox user | FOLD           |
| POST       | `/mailboxes/:mailbox_id/folders`            | Buat custom folder.                                                   | Mailbox user | FOLD           |
| DELETE     | `/mailboxes/:mailbox_id/folders/:folder_id` | Transaction: move seluruh message ke Inbox lalu delete custom folder. | Mailbox user | FOLD           |

Penghapusan custom folder menonaktifkan ruleset yang mereferensikan folder tersebut dan menghasilkan `message_updated` per message yang dipindahkan.

## 8.7 Rulesets

| **Method** | **Endpoint**                                  | **Deskripsi**                                                           | **Akses**    | **Terkait FR** |
| ---------- | --------------------------------------------- | ----------------------------------------------------------------------- | ------------ | -------------- |
| GET        | `/mailboxes/:mailbox_id/rulesets`             | List ruleset dengan opaque cursor; 10 per batch.                        | Mailbox user | RULE           |
| POST       | `/mailboxes/:mailbox_id/rulesets`             | Create ruleset + conditions + actions.                                  | Mailbox user | RULE           |
| GET        | `/mailboxes/:mailbox_id/rulesets/:ruleset_id` | Detail.                                                                 | Mailbox user | RULE           |
| PUT        | `/mailboxes/:mailbox_id/rulesets/:ruleset_id` | Atomic update parent + replace conditions/actions dalam D1 transaction. | Mailbox user | RULE           |
| DELETE     | `/mailboxes/:mailbox_id/rulesets/:ruleset_id` | Delete ruleset.                                                         | Mailbox user | RULE           |

`priority` dikirim sebagai integer eksplisit saat create/update. `PUT` menerima ordered arrays condition/action; backend menyimpan `condition_order` dan `action_order` berdasarkan urutan payload final dalam transaction yang sama. UI dapat menghasilkan urutan final melalui drag-and-drop atau kontrol Up/Down, tetapi backend tidak membutuhkan endpoint reorder terpisah pada MVP.

## 8.8 Sync

| **Method** | **Endpoint**                            | **Deskripsi**                                                                             | **Akses**    | **Terkait FR** |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------------- | ------------ | -------------- |
| GET        | `/mailboxes/:mailbox_id/sync`           | Delta berdasarkan `last_sync_timestamp`; `latest_message_id` fallback untuk message baru. | Mailbox user | SYNC           |
| POST       | `/mailboxes/:mailbox_id/sync/mutations` | Proses batch mutation FIFO; return result per mutation.                                   | Mailbox user | SYNC/OPTI      |

# 9. Autentikasi & Otorisasi

Password menggunakan Bcrypt. JWT access token ditandatangani dengan HS256 dan berlaku 15 menit. Access token hanya berada di memory frontend dan dikirim sebagai `Authorization: Bearer <access_token>`. Refresh token berlaku 30 hari, disimpan di `localStorage`, dan dikirim melalui request body ke `/auth/refresh`.

Setelah reload, frontend menggunakan refresh token untuk mendapatkan access token baru. Beberapa tab memiliki access token memory masing-masing tetapi berbagi refresh token pada `localStorage`. Login dan refresh mengembalikan access token serta refresh token dalam response body.

Refresh rotation me-revoke token sebelumnya. Reuse token lama ditolak tanpa me-revoke seluruh token chain. Logout mengirim refresh token untuk revoke current session, kemudian frontend menghapus token dan seluruh Dexie/Cache API terkait. Perubahan password oleh user/admin me-revoke seluruh refresh token user. Deactivate user juga me-revoke seluruh refresh token.

| **Peran** | **Hak Akses Teknis**                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `admin`   | User management, domain management, create/update/activate/deactivate mailbox, serta seluruh hak mailbox yang terhubung. |
| `member`  | Mengakses mailbox yang terhubung dan mengelola message, folder, ruleset, search, dan sync.                               |

Seluruh endpoint mailbox-scoped menjalankan authorization middleware terhadap `mailbox_users`. Semua user yang terhubung ke mailbox memiliki hak mailbox yang sama.

# 10. Integrasi Pihak Ketiga (Detail Teknis)

| **Layanan**               | **Metode Integrasi**                       | **Kredensial**                          | **Catatan Teknis**                                                                                                      |
| ------------------------- | ------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Email Routing  | Email Worker handler                       | Cloudflare binding/config               | Catch-all diarahkan ke Worker; unknown local-part ditolak.                                                              |
| Cloudflare D1             | Worker binding + Drizzle                   | D1 binding                              | Source of truth metadata/state.                                                                                         |
| Cloudflare R2             | Worker binding                             | R2 binding                              | Private raw RFC-822 storage.                                                                                            |
| Cloudflare domain/DNS API | REST API                                   | Scoped API token                        | Digunakan untuk daftar domain dan verification state; exact verification checks mengikuti konfigurasi Cloudflare final. |
| Workers Static Assets     | Worker deployment                          | Cloudflare project config               | Hosting Vue production assets.                                                                                          |
| shadcn-vue                | Source/component integration pada frontend | Tidak ada kredensial                    | Komponen diintegrasikan ke source project dan dapat dikustomisasi sesuai design tokens Runmail.                         |
| Iconify                   | `@iconify/vue`                             | Tidak ada kredensial untuk bundle lokal | Framework render icon frontend; gunakan Lucide sebagai satu icon set utama.                                             |

# 11. Keamanan

- **Password :** Bcrypt; password 8–128 karakter.
- **JWT :** HS256 secret disimpan sebagai Cloudflare secret, bukan repository.
- **Token Storage :** access token memory; refresh token `localStorage`.
- **Authorization :** central mailbox authorization middleware.
- **Mailbox Isolation :** repository/query mailbox-scoped wajib menerima/validasi `mailbox_id`.
- **Input Validation :** username, local-part, folder, ruleset, regex, IDs, cursor, dan mutation payload divalidasi.
- **Raw Email :** R2 private; akses raw hanya melalui Worker setelah authorization.
- **HTML Email :** sanitasi sebelum render; remote images diblokir default dan hanya dimuat atas aksi user untuk message yang sedang dibuka. Tidak ada persistent allowlist sender/domain pada MVP.
- **Frontend Supply Chain :** dependency shadcn-vue/Iconify/Tailwind dikunci melalui lockfile dan perubahan komponen `components/ui` direview sebagai source code aplikasi.
- **Secrets :** credential dan signing secret menggunakan environment/Cloudflare secrets.
- **Transport :** HTTPS.
- **Error Handling :** tidak membocorkan stack trace, password hash, token hash, secret, atau internal R2 detail.
- **Rate Limiting :** tidak ada application-level login rate limiting pada MVP.

# 12. Environment & Konfigurasi

Environment hanya `development` dan `production`. D1 dan R2 terpisah untuk masing-masing environment.

| **Variable/Binding**        | **Fungsi**                      | **Environment**       |
| --------------------------- | ------------------------------- | --------------------- |
| `APP_ENV`                   | `development` / `production`.   | Semua                 |
| `APP_ORIGIN`                | Origin frontend/CORS.           | Semua                 |
| `JWT_SIGNING_SECRET`        | HS256 signing secret.           | Semua, secret berbeda |
| `JWT_ACCESS_TTL_SECONDS`    | 15 menit.                       | Semua                 |
| `REFRESH_TOKEN_TTL_SECONDS` | 30 hari.                        | Semua                 |
| `DB`                        | D1 binding environment terkait. | Semua                 |
| `RAW_EMAIL_BUCKET`          | R2 binding environment terkait. | Semua                 |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare integration.         | Semua                 |
| `CLOUDFLARE_API_TOKEN`      | Scoped API credential.          | Semua, secret         |
| `MAX_EMAIL_BYTES`           | 25 MB.                          | Semua                 |
| `SYNC_RETENTION_DAYS`       | 30 hari.                        | Semua                 |
| `TRASH_SPAM_RETENTION_DAYS` | 30 hari.                        | Semua                 |

Frontend build-time configuration untuk shadcn-vue, Tailwind, dan Iconify disimpan pada source/config project dan tidak membutuhkan secret.

# 13. Deployment & Infrastruktur

Frontend Vue dibuild dan di-host menggunakan Cloudflare Workers Static Assets. Backend Hono berjalan pada Cloudflare Workers. Development dan production menggunakan D1 database serta R2 bucket terpisah.

Source code dikelola dalam monorepo. CI menjalankan minimal type-check, lint, unit test, integration test, dan validasi migration. Production deployment dilakukan manual dari CI/CD setelah branch utama lolos checks; merge ke branch utama tidak otomatis melakukan production deploy.

Drizzle migration disimpan di repository dan dijalankan sebagai bagian deployment sebelum code yang membutuhkan schema baru diaktifkan. Dexie memakai schema versioning. Bila local projection perlu dibangun ulang, pending `sync_queue` dipertahankan, metadata direbuild dari server, lalu pending mutation direplay.

Frontend build harus mengompilasi Tailwind/shadcn-vue styles dan Iconify/Lucide usage tanpa memerlukan runtime icon provider eksternal untuk icon aplikasi utama. Monitoring MVP menggunakan Cloudflare logging/analytics bawaan. Log menggunakan structured JSON. Setiap HTTP request dan inbound email memiliki `request_id` yang dipropagasikan ke log. Backup/recovery production mengandalkan capability Cloudflare yang tersedia; tidak ada sistem backup custom pada MVP.

# 14. Strategi Testing

- **Unit Test :** ruleset matcher, `match_type`, priority, action ordering, validation, auth helper, sync helper.
- **D1 Test :** schema constraint, Drizzle migration, mailbox isolation, folder transaction, ruleset transaction, message sorting, sync ordering.
- **Dexie Test :** database per mailbox, schema migration, local projection, sync state, queue persistence.
- **Sync Test :** event types, delta ordering, batch FIFO, partial mutation failure, rollback, full resync, queue replay, tombstone.
- **Email Ingest Test :** valid inbound, unknown local-part, inactive domain/mailbox, oversized email, no-rule-match, Date fallback, multi-recipient copy, R2→D1 persistence failure.
- **Ruleset Test :** all matching rulesets execute by ascending numeric priority; conditions/actions mempertahankan order payload editor; actions execute by `action_order`; last move wins; failed action is skipped; invalid regex rejected.
- **Folder Test :** move dari folder mana pun, Trash/Spam retention reset, custom folder delete transaction, dependent ruleset disable.
- **Frontend UI Test :** komponen shadcn-vue, keyboard/focus state, responsive layout, dark/light token readiness bila digunakan, Iconify render, dan konsistensi icon Lucide.
- **Frontend Functional Test :** auto-select single mailbox, mailbox selection pagination, mailbox switch lifecycle, mailbox-scoped deep-link/route guard, local search, pagination 10/batch, optimistic state, queue isolation per mailbox, raw Cache API hit/miss, sanitized HTML, remote image blocking/load-per-message, ruleset reorder controls, duplicate mailbox field-level error, attachment extraction.
- **Security Test :** cross-mailbox access, inactive user/mailbox, invalid/expired JWT, refresh rotation, raw authorization, malicious HTML.
- **Manual QA :** Chrome, Firefox, dan Edge modern pada desktop/mobile responsive.

# 15. Risiko Teknis & Mitigasi

| **Risiko**                                             | **Dampak**                                                       | **Mitigasi**                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `sync_version` concurrency pada D1.                    | Delta dapat salah urut.                                          | Implementasikan sequence monotonik per mailbox dan integration test concurrent mutation.                                     |
| `last_sync_timestamp` dapat sama untuk beberapa event. | Cursor timestamp berpotensi ambigu.                              | Gunakan `sync_version` sebagai internal ordering/consistency saat membentuk dan menerapkan delta.                            |
| Sync history hanya 30 hari.                            | Device offline lama tidak dapat delta incremental.               | Return `full_resync_required`; preserve queue, rebuild projection, replay queue.                                             |
| Dexie bukan source of truth.                           | Local state dapat stale.                                         | Delta sync dan full resync.                                                                                                  |
| Local search melakukan scan.                           | Search melambat pada mailbox besar.                              | Benchmark; tambah normalized/index strategy hanya jika dibutuhkan.                                                           |
| Raw HTML email untrusted.                              | XSS/tracking.                                                    | Sanitization dan block remote images default.                                                                                |
| Mailbox isolation bergantung aplikasi.                 | Cross-mailbox exposure.                                          | Central middleware dan integration test isolation.                                                                           |
| Refresh token berada di `localStorage`.                | XSS dapat mengekspos refresh token.                              | CSP ketat, sanitasi untrusted HTML, dependency hygiene, hindari inline/eval, dan minimalkan surface XSS.                     |
| Inconsistent icon usage.                               | UI terlihat campur gaya dan sulit dipelihara.                    | Tetapkan Lucide sebagai icon set utama di Iconify dan centralize icon mapping bila perlu.                                    |
| shadcn-vue components dimodifikasi langsung di source. | Upgrade/copy komponen baru dapat menimbulkan drift.              | Treat `components/ui` sebagai owned source code, review perubahan, dan gunakan design token/style convention yang konsisten. |
| Worker memproses email sampai 25 MB.                   | CPU/memory runtime pressure.                                     | Parse metadata seperlunya dan benchmark ukuran maksimum.                                                                     |
| Exact Cloudflare domain verification belum dikunci.    | Domain onboarding dapat berubah mengikuti API/config Cloudflare. | Spike integrasi menggunakan official Cloudflare API/config sebelum modul domain production.                                  |

# 16. Pertanyaan Terbuka / TBD

- Exact Cloudflare API/status/record yang menentukan domain `active` untuk Email Routing/DNS.
- Mekanisme implementasi atomic monotonic `sync_version` per mailbox pada D1.
- Index D1 final setelah benchmark query produksi.
- Exact MIME/email parser library server-side setelah compatibility/performance benchmark pada Workers.
- Exact HTML sanitizer library frontend.
- Batas biaya/operasional Cloudflare Workers, D1, R2, dan Email Service pada skala produksi.
- Nama domain utama SaaS Runmail dan konfigurasi brand/domain operasional tetap mengikuti keputusan PRD/operasional.
- Timeline pengembangan dan target rilis MVP merupakan keputusan project/business, bukan keputusan Tech Plan.

---

_Dokumen ini merupakan draft sementara v0.5 dan dapat berubah seiring pembahasan lebih lanjut dengan tim pengembang. Dokumen ini merujuk pada PRD Runmail v0.5 dan telah diperbarui berdasarkan keputusan UI/UX technical clarification hingga 9 September 2026._
