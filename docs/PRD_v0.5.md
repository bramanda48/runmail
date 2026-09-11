# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Runmail

**STATUS: DRAFT SEMENTARA**

|                     |                                                                   |
| ------------------- | ----------------------------------------------------------------- |
| **Nama Produk**     | Runmail                                                           |
| **Versi Dokumen**   | v0.5                                                              |
| **Disusun oleh**    | Pengembang                                                        |
| **Untuk**           | Klien                                                             |
| **Tanggal**         | 31 Agustus 2026                                                   |
| **Dokumen Terkait** | TEMPLATE_PRD.md, TBD.txt, dan hasil klarifikasi kebutuhan Runmail |

---

# 1. Ringkasan Produk (Overview)

Runmail merupakan aplikasi SaaS email inbox yang menyediakan pengelolaan email seperti layanan email modern dengan dukungan multi-mailbox, multi-domain, dan multi-user. Dalam model Runmail, **mailbox merupakan unit tenant sekaligus boundary isolasi data**; tidak ada entitas tenant/workspace terpisah. Satu user dapat mengelola beberapa mailbox dan satu mailbox dapat dikelola beberapa user dengan hak mailbox yang sama. Kombinasi `(domain, local_part)` harus unik secara global di Runmail sehingga satu alamat email merepresentasikan tepat satu mailbox.

Backend menggunakan Cloudflare Workers dan Hono, dengan Cloudflare Email Service untuk penerimaan email. Raw email RFC-822 disimpan utuh di Cloudflare R2, sedangkan metadata/index disimpan di Cloudflare D1 melalui Drizzle ORM. Frontend menggunakan Vue 3, Dexie.js/IndexedDB untuk metadata lokal, Cache API untuk raw `.eml`, serta `postal-mime` untuk parsing client-side. Arsitektur menggunakan delta synchronization, on-demand raw-email fetching, optimistic UI, dan sync queue.

# 2. Tujuan & Sasaran (Goals)

- Memusatkan pengelolaan beberapa domain dan mailbox dalam satu aplikasi SaaS dengan mailbox sebagai unit tenant.
- Memungkinkan beberapa user mengelola mailbox yang sama dengan kontrol akses yang jelas.
- Mengurangi transfer data melalui delta sync dan on-demand fetching raw email.
- Memberikan pengalaman inbox yang cepat melalui IndexedDB, Cache API, dan optimistic UI.
- Menyediakan filtering email sebelum penyimpanan melalui ruleset deterministik.
- Menjaga integritas penerimaan email melalui validasi alamat, ukuran, ruleset, domain, dan keberhasilan penyimpanan.

# 3. Pengguna & Peran (Users & Roles)

- **Admin :** dapat mengelola user dan domain, serta membuat, mengubah, menghapus, mengaktifkan, dan menonaktifkan mailbox.
- **Member :** dapat menggunakan mailbox yang terhubung kepadanya. Seluruh user yang terhubung ke mailbox memiliki hak mailbox yang sama, termasuk pengelolaan ruleset dan folder custom.

# 4. Ruang Lingkup (Scope)

## 4.1 Termasuk (MVP)

- Authentication username/password dengan Bearer JWT, refresh token, rotation, dan revocation.
- Role `admin` dan `member`; member hanya dibuat oleh admin.
- Multi-domain.
- Multi-mailbox dengan relasi many-to-many user-mailbox; mailbox merupakan unit tenant.
- Inbox standar: receive, list, detail, read/unread, star/unstar, move, Trash, permanent delete, search, dan pagination.
- Folder system dan custom.
- Ruleset filtering sebelum penyimpanan dengan multiple condition, AND/OR satu tingkat, priority, dan ordered actions.
- Raw RFC-822 di R2 dan metadata/index di D1.
- Delta sync, optimistic UI, sync queue, conflict resolution, tombstone, dan full resync.
- On-demand `.eml` fetching, Cache API, dan parsing menggunakan `postal-mime`.
- Auto-delete Trash/Spam setelah 30 hari menggunakan Cloudflare Cron Triggers harian.
- Responsive web untuk browser modern yang didukung.

## 4.2 Di Luar Lingkup Awal / Fase Lanjutan

- Spam detection otomatis.
- Storage metering dan quota mailbox.

# 5. Asumsi & Batasan (Assumptions & Constraints)

- Frontend menggunakan Vue 3.
- Backend menggunakan Hono pada Cloudflare Workers.
- Runtime development JavaScript menggunakan Bun.
- Metadata/index menggunakan Cloudflare D1 dan Drizzle ORM.
- Raw RFC-822 menggunakan Cloudflare R2.
- Metadata lokal menggunakan IndexedDB melalui Dexie.js.
- Raw `.eml` lokal menggunakan Cache API.
- Parsing `.eml` client-side menggunakan `postal-mime`.
- Ukuran maksimal raw email beserta attachment adalah 25 MB.
- Tidak ada limit jumlah mailbox per user.
- Data terstruktur diprioritaskan menggunakan tabel turunan/relasional dan bukan JSON.
- Ruleset condition dan action tidak disimpan sebagai JSON.
- Attachment tetap menjadi bagian raw RFC-822 dan tidak perlu disimpan sebagai object R2 terpisah.
- Raw RFC-822 disimpan tanpa enkripsi aplikasi tambahan di atas mekanisme storage Cloudflare.
- Message selain Trash/Spam disimpan tanpa batas waktu sampai user menghapusnya.
- MVP tidak menerapkan storage quota aplikasi.
- Sync conflict menggunakan monotonic `sync_version` dan server-ordered last-write-wins.
- **Mailbox adalah tenant boundary** untuk isolasi message, folder, ruleset, dan state sinkronisasi.

# 6. Kebutuhan Fungsional (Functional Requirements)

## 6.1 Authentication & Session

| **ID**      | **Kebutuhan Fungsional**                                                                            | **Prioritas** |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------- |
| **AUTH-1**  | User dapat login menggunakan username dan password.                                                 | **Wajib**     |
| **AUTH-2**  | API menggunakan Bearer JWT sebagai access token.                                                    | **Wajib**     |
| **AUTH-3**  | Access token berlaku 15 menit.                                                                      | **Wajib**     |
| **AUTH-4**  | Sistem menggunakan refresh token dengan masa berlaku 30 hari.                                       | **Wajib**     |
| **AUTH-5**  | Setiap refresh menghasilkan refresh token baru dan token sebelumnya menjadi invalid.                | **Wajib**     |
| **AUTH-6**  | Logout me-revoke refresh token/session yang sedang digunakan.                                       | **Wajib**     |
| **AUTH-7**  | Logout tidak otomatis mengeluarkan user dari device lain.                                           | **Wajib**     |
| **AUTH-8**  | Saat logout, frontend menghapus IndexedDB dan Cache API milik user/session pada perangkat tersebut. | **Wajib**     |
| **AUTH-9**  | Password memiliki panjang 8–128 karakter.                                                           | **Wajib**     |
| **AUTH-10** | Sistem membedakan role `admin` dan `member`.                                                        | **Wajib**     |
| **AUTH-11** | Sistem tidak menyediakan registrasi member secara mandiri.                                          | **Wajib**     |

## 6.2 User Management

| **ID**     | **Kebutuhan Fungsional**                                                                   | **Prioritas** |
| ---------- | ------------------------------------------------------------------------------------------ | ------------- |
| **USER-1** | Admin dapat menambahkan member melalui user management.                                    | **Wajib**     |
| **USER-2** | Username mengikuti pola `[A-Za-z0-9\-_\.]{6,20}`.                                          | **Wajib**     |
| **USER-3** | User merupakan akun global Runmail dan tidak terikat ke entitas tenant/workspace terpisah. | **Wajib**     |
| **USER-4** | Sistem menerapkan otorisasi mailbox berdasarkan relasi `mailbox_users`.                    | **Wajib**     |

## 6.3 Domain Management

| **ID**     | **Kebutuhan Fungsional**                                                                 | **Prioritas** |
| ---------- | ---------------------------------------------------------------------------------------- | ------------- |
| **DOMN-1** | Admin dapat menambahkan beberapa domain.                                                 | **Wajib**     |
| **DOMN-2** | Domain yang dapat ditambahkan dibatasi pada domain Cloudflare yang tersedia bagi sistem. | **Wajib**     |
| **DOMN-3** | Domain baru memiliki status `pending_verification`.                                      | **Wajib**     |
| **DOMN-4** | Domain berubah menjadi `active` setelah verifikasi Email Routing/DNS berhasil.           | **Wajib**     |
| **DOMN-5** | Mailbox tidak dapat dibuat pada domain yang belum `active`.                              | **Wajib**     |
| **DOMN-6** | Satu domain dapat digunakan oleh beberapa mailbox.                                       | **Wajib**     |

## 6.4 Mailbox Management

| **ID**     | **Kebutuhan Fungsional**                                                                                          | **Prioritas** |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| **MBX-1**  | Mailbox memiliki local-part sendiri dan tidak mengambil username user aplikasi.                                   | **Wajib**     |
| **MBX-2**  | Local-part mengikuti aturan RFC yang berlaku untuk alamat email.                                                  | **Wajib**     |
| **MBX-3**  | Satu mailbox merupakan unit tenant dan merepresentasikan tepat satu `(domain + local_part)` tanpa alias pada MVP. | **Wajib**     |
| **MBX-4**  | Kombinasi `(domain, local_part)` harus unik secara global di Runmail.                                             | **Wajib**     |
| **MBX-5**  | Satu user dapat mengelola beberapa mailbox tanpa limit aplikasi.                                                  | **Wajib**     |
| **MBX-6**  | Satu mailbox dapat dikelola beberapa user.                                                                        | **Wajib**     |
| **MBX-7**  | Seluruh user yang terhubung ke mailbox memiliki hak mailbox yang sama.                                            | **Wajib**     |
| **MBX-8**  | Hanya admin yang dapat membuat, mengubah, menghapus, mengaktifkan, atau menonaktifkan mailbox.                    | **Wajib**     |
| **MBX-9**  | Email untuk local-part yang tidak terdaftar harus di-reject.                                                      | **Wajib**     |
| **MBX-10** | Mailbox menjadi boundary isolasi data untuk message, folder, ruleset, dan sync state/event.                       | **Wajib**     |

## 6.5 Email Receiving & Storage

| **ID**     | **Kebutuhan Fungsional**                                                                                                                | **Prioritas** |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **MAIL-1** | Sistem menerima email melalui Cloudflare Email Service dan memprosesnya melalui Worker.                                                 | **Wajib**     |
| **MAIL-2** | Backend melakukan parsing minimal untuk memperoleh `from`, `to`, `subject`, header, tanggal, dan snippet.                               | **Wajib**     |
| **MAIL-3** | Backend menyimpan raw RFC-822 tanpa modifikasi ke R2.                                                                                   | **Wajib**     |
| **MAIL-4** | Backend menyimpan metadata/index ke D1.                                                                                                 | **Wajib**     |
| **MAIL-5** | Attachment tetap menjadi bagian raw RFC-822.                                                                                            | **Wajib**     |
| **MAIL-6** | Email dengan total ukuran lebih dari 25 MB harus di-reject.                                                                             | **Wajib**     |
| **MAIL-7** | Jika write D1 atau R2 gagal, proses ingest dianggap gagal dan email di-reject dengan reason yang meminta pengirim mengirim ulang.       | **Wajib**     |
| **MAIL-8** | Partial write D1/R2 harus dibersihkan/dikompensasi agar message tidak dianggap berhasil diterima secara parsial.                        | **Wajib**     |
| **MAIL-9** | Satu email yang ditujukan ke beberapa mailbox Runmail menghasilkan message terpisah pada masing-masing mailbox dengan state independen. | **Wajib**     |

## 6.6 Inbox

| **ID**     | **Kebutuhan Fungsional**                                                                    | **Prioritas** |
| ---------- | ------------------------------------------------------------------------------------------- | ------------- |
| **INBX-1** | User dapat melihat daftar message mailbox yang dapat dikelolanya.                           | **Wajib**     |
| **INBX-2** | User dapat membuka detail message.                                                          | **Wajib**     |
| **INBX-3** | User dapat mengubah read/unread.                                                            | **Wajib**     |
| **INBX-4** | User dapat mengubah star/unstar.                                                            | **Wajib**     |
| **INBX-5** | User dapat memindahkan message dari folder mana pun ke folder lain dalam mailbox yang sama. | **Wajib**     |
| **INBX-6** | User dapat memindahkan message dari folder mana pun ke Trash.                               | **Wajib**     |
| **INBX-7** | User dapat melakukan permanent delete dari Trash.                                           | **Wajib**     |
| **INBX-8** | Inbox menggunakan nilai `Date` dari email sebagai dasar urutan message.                     | **Wajib**     |

## 6.7 Folder Management

| **ID**     | **Kebutuhan Fungsional**                                                               | **Prioritas** |
| ---------- | -------------------------------------------------------------------------------------- | ------------- |
| **FOLD-1** | Folder memiliki tipe `system` atau `custom`.                                           | **Wajib**     |
| **FOLD-2** | System folder MVP adalah `inbox`, `draft`, `sent`, `spam`, `archive`, dan `trash`.     | **Wajib**     |
| **FOLD-3** | System folder dibuat sistem, permanen, tidak dapat dihapus, dan tidak dapat di-rename. | **Wajib**     |
| **FOLD-4** | User yang memiliki akses mailbox dapat membuat folder custom.                          | **Wajib**     |
| **FOLD-5** | Nama custom folder harus unik secara case-insensitive dalam mailbox.                   | **Wajib**     |
| **FOLD-6** | Nama custom folder tidak boleh sama dengan nama reserved system folder.                | **Wajib**     |
| **FOLD-7** | Saat custom folder dihapus, seluruh message di dalamnya dipindahkan ke Inbox.          | **Wajib**     |
| **FOLD-8** | Satu message hanya dapat berada pada satu folder pada satu waktu.                      | **Wajib**     |

## 6.8 Ruleset

| **ID**      | **Kebutuhan Fungsional**                                                                                         | **Prioritas** |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| **RULE-1**  | Ruleset dievaluasi sebelum message disimpan.                                                                     | **Wajib**     |
| **RULE-2**  | User yang terhubung ke mailbox dapat membuat dan mengubah ruleset mailbox tersebut.                              | **Wajib**     |
| **RULE-3**  | Satu ruleset dapat memiliki beberapa condition.                                                                  | **Wajib**     |
| **RULE-4**  | Condition menggunakan satu operator logika AND atau OR untuk seluruh condition dalam ruleset.                    | **Wajib**     |
| **RULE-5**  | Nested grouping seperti `(A AND B) OR (C AND D)` tidak didukung.                                                 | **Wajib**     |
| **RULE-6**  | Field condition yang tersedia adalah `from`, `subject`, dan `header`.                                            | **Wajib**     |
| **RULE-7**  | Condition `header` mengevaluasi keseluruhan raw header, misalnya `header contains X-Mailer`.                     | **Wajib**     |
| **RULE-8**  | Match type adalah `contains`, `not contains`, `equal`, `not equal`, `start with`, `end with`, dan `match regex`. | **Wajib**     |
| **RULE-9**  | Match type non-regex bersifat case-insensitive; regex mengikuti expression user.                                 | **Wajib**     |
| **RULE-10** | Regex/expression invalid harus ditolak saat create/update.                                                       | **Wajib**     |
| **RULE-11** | Ruleset memiliki priority.                                                                                       | **Wajib**     |
| **RULE-12** | Seluruh ruleset yang match dieksekusi berurutan berdasarkan priority.                                            | **Wajib**     |
| **RULE-13** | Action ruleset adalah `move to folder`, `mark as star`, dan `mark as read`.                                      | **Wajib**     |
| **RULE-14** | User dapat mengatur `action_order` dan action dijalankan sesuai urutan tersebut.                                 | **Wajib**     |
| **RULE-15** | Jika beberapa move action dieksekusi, move terakhir menentukan folder final.                                     | **Wajib**     |
| **RULE-16** | Jika tidak ada ruleset yang match, email harus di-reject menggunakan `setReject`.                                | **Wajib**     |
| **RULE-17** | Condition dan action disimpan dalam tabel turunan/relasional, bukan JSON.                                        | **Wajib**     |

## 6.9 Delta Synchronization

| **ID**      | **Kebutuhan Fungsional**                                                                           | **Prioritas** |
| ----------- | -------------------------------------------------------------------------------------------------- | ------------- |
| **SYNC-1**  | Frontend menyimpan metadata/index pada IndexedDB menggunakan Dexie.js.                             | **Wajib**     |
| **SYNC-2**  | `last_sync_timestamp` digunakan sebagai cursor utama.                                              | **Wajib**     |
| **SYNC-3**  | `latest_message_id` digunakan sebagai fallback untuk sinkronisasi message baru.                    | **Wajib**     |
| **SYNC-4**  | Backend hanya mengembalikan delta perubahan sejak cursor client.                                   | **Wajib**     |
| **SYNC-5**  | Backend menggunakan monotonic `sync_version` untuk mengurutkan perubahan.                          | **Wajib**     |
| **SYNC-6**  | Konflik state diselesaikan menggunakan server-ordered last-write-wins.                             | **Wajib**     |
| **SYNC-7**  | Delta mencakup message baru, read/unread, star/unstar, folder/move, dan deletion.                  | **Wajib**     |
| **SYNC-8**  | Backend menyimpan sync history selama 30 hari.                                                     | **Wajib**     |
| **SYNC-9**  | Cursor yang sudah tidak tersedia menghasilkan `full_resync_required`.                              | **Wajib**     |
| **SYNC-10** | Frontend melakukan full metadata resync ketika menerima `full_resync_required`.                    | **Wajib**     |
| **SYNC-11** | Permanent delete menghasilkan tombstone/event `message_deleted` yang tersedia selama 30 hari.      | **Wajib**     |
| **SYNC-12** | `message_deleted` menyebabkan frontend menghapus metadata lokal dan `.eml` terkait dari Cache API. | **Wajib**     |

## 6.10 On-Demand Raw Email

| **ID**    | **Kebutuhan Fungsional**                                                                | **Prioritas** |
| --------- | --------------------------------------------------------------------------------------- | ------------- |
| **EML-1** | Message baru hanya menyinkronkan metadata; raw `.eml` tidak otomatis di-download.       | **Wajib**     |
| **EML-2** | Saat detail dibuka, frontend mengecek Cache API terlebih dahulu.                        | **Wajib**     |
| **EML-3** | Jika cache tidak tersedia, frontend mengambil raw `.eml` melalui Worker dari R2.        | **Wajib**     |
| **EML-4** | Raw `.eml` hasil fetch disimpan di Cache API.                                           | **Wajib**     |
| **EML-5** | Frontend melakukan parsing menggunakan `postal-mime`.                                   | **Wajib**     |
| **EML-6** | Raw `.eml` yang sudah tersedia di cache dapat dibaca tanpa request network.             | **Wajib**     |
| **EML-7** | Jika parsing gagal, UI menampilkan error parsing tetapi raw `.eml` tetap dipertahankan. | **Wajib**     |

## 6.11 Optimistic UI & Sync Queue

| **ID**     | **Kebutuhan Fungsional**                                                             | **Prioritas** |
| ---------- | ------------------------------------------------------------------------------------ | ------------- |
| **OPTI-1** | Read/unread, star/unstar, dan folder/move diperbarui secara optimistic di IndexedDB. | **Wajib**     |
| **OPTI-2** | Mutation lokal dimasukkan ke sync queue dan dikirim ke backend di background.        | **Wajib**     |
| **OPTI-3** | Mutation yang gagal karena koneksi tetap berada di queue dan di-retry.               | **Wajib**     |
| **OPTI-4** | Jika backend secara definitif menolak mutation, frontend rollback ke server state.   | **Wajib**     |

## 6.12 Search & Pagination

| **ID**     | **Kebutuhan Fungsional**                                                       | **Prioritas** |
| ---------- | ------------------------------------------------------------------------------ | ------------- |
| **SRCH-1** | Search dilakukan terhadap metadata lokal di IndexedDB.                         | **Wajib**     |
| **SRCH-2** | Search tidak mencari isi body email.                                           | **Wajib**     |
| **SRCH-3** | Search `from`, `to`, dan `subject` menggunakan partial match case-insensitive. | **Wajib**     |
| **SRCH-4** | Search umum mencari `from OR to OR subject`.                                   | **Wajib**     |
| **SRCH-5** | Search mendukung filter `from:`, `to:`, dan `subject:`.                        | **Wajib**     |
| **SRCH-6** | Listing menggunakan cursor-based pagination.                                   | **Wajib**     |
| **SRCH-7** | Default batch size adalah 10 message.                                          | **Wajib**     |

## 6.13 Retention

| **ID**      | **Kebutuhan Fungsional**                                                          | **Prioritas** |
| ----------- | --------------------------------------------------------------------------------- | ------------- |
| **RETN-1**  | Trash dan Spam memiliki retensi 30 hari.                                          | **Wajib**     |
| **RETN-2**  | Retensi dihitung sejak message terakhir masuk ke Trash/Spam.                      | **Wajib**     |
| **RETN-3**  | Jika message keluar lalu masuk kembali ke Trash/Spam, timestamp retensi di-reset. | **Wajib**     |
| **RETN-4**  | Cron Trigger menjalankan cleanup satu kali sehari.                                | **Wajib**     |
| **RETN-5**  | Cleanup menghapus metadata/index D1 dan raw RFC-822 R2.                           | **Wajib**     |
| **RETN-6**  | Message di Trash dapat dihapus permanen secara manual.                            | **Wajib**     |
| **RETN-10** | Message selain Trash/Spam disimpan sampai user menghapusnya.                      | **Wajib**     |

# 7. Alur Pengguna Utama (Key User Flows)

## 7.1 Login dan Pemilihan Mailbox

1. User login dengan username dan password.
2. Backend memvalidasi kredensial dan menerbitkan access JWT serta refresh token.
3. Backend mengembalikan daftar mailbox yang terhubung ke user melalui `mailbox_users`.
4. User memilih mailbox yang ingin dikelola.
5. Mailbox tersebut menjadi tenant boundary untuk seluruh operasi message, folder, ruleset, dan sync.
6. Frontend membaca metadata IndexedDB untuk mailbox tersebut.
7. Frontend meminta delta menggunakan cursor sinkronisasi terakhir.
8. Backend mengembalikan perubahan beserta `sync_version`.
9. Jika cursor kedaluwarsa, backend mengembalikan `full_resync_required`.

## 7.2 Penerimaan Email

1. Email diterima melalui Cloudflare Email Service.
2. Worker menentukan mailbox berdasarkan kombinasi `(domain, local_part)`.
3. Jika alamat tidak terdaftar, email di-reject.
4. Worker memvalidasi ukuran maksimum 25 MB.
5. Backend melakukan parsing metadata/snippet.
6. Backend mengevaluasi ruleset milik mailbox tujuan berdasarkan priority.
7. Seluruh ruleset yang match dan seluruh action-nya dieksekusi berurutan.
8. Jika tidak ada ruleset yang match, email di-reject menggunakan `setReject`.
9. Raw RFC-822 disimpan ke R2 dan metadata/index disimpan ke D1.
10. Jika salah satu penyimpanan gagal, ingest dianggap gagal, partial write dibersihkan, dan email di-reject dengan reason agar pengirim mengirim ulang.
11. Message hanya menjadi milik mailbox tujuan tersebut.

## 7.3 Membuka Detail Email

1. User memilih message dalam mailbox aktif.
2. Frontend membaca metadata dari IndexedDB.
3. Frontend mengecek Cache API.
4. Jika `.eml` tersedia, frontend membacanya tanpa network request.
5. Jika belum tersedia, frontend mengambil `.eml` melalui Worker dari R2 lalu menyimpannya ke Cache API.
6. Frontend mem-parse `.eml` menggunakan `postal-mime`.
7. Jika parsing gagal, UI menampilkan error dan raw `.eml` tetap dipertahankan.

## 7.4 Optimistic Mutation

1. User mengubah read/star/folder dalam mailbox aktif.
2. Frontend langsung memperbarui IndexedDB dan UI.
3. Mutation masuk sync queue untuk mailbox tersebut.
4. Backend memproses mutation secara berurutan dan menghasilkan `sync_version`.
5. Jika koneksi gagal, mutation di-retry.
6. Jika backend menolak mutation secara definitif, frontend rollback ke server state.

## 7.5 Move Message

1. User membuka mailbox dan memilih message dari folder mana pun.
2. User memilih action `move` dan menentukan folder tujuan.
3. Frontend langsung memperbarui `folder_id` message secara optimistic di IndexedDB.
4. Mutation `move` dimasukkan ke sync queue.
5. Backend memvalidasi bahwa user memiliki akses ke mailbox dan folder tujuan berada pada mailbox yang sama.
6. Backend memperbarui folder message dan menghasilkan perubahan sync.
7. Device lain menerima perubahan folder melalui delta sync.
8. Jika mutation gagal karena koneksi, mutation tetap berada di queue untuk di-retry.
9. Jika backend menolak mutation secara definitif, frontend rollback ke server state.

# 7.6 Trash dan Permanent Delete

1. User memindahkan message ke Trash.
2. Sistem mencatat waktu saat message masuk ke Trash untuk kebutuhan retensi 30 hari.
3. User dapat memindahkan message dari Trash ke folder lain atau melakukan permanent delete.
4. Permanent delete menghapus D1/R2 dan membuat tombstone `message_deleted`.
5. Device lain yang memiliki akses ke mailbox menerima tombstone saat sync dan menghapus metadata serta Cache API lokal.
6. Jika tidak dihapus manual, Cron Trigger menghapus message setelah 30 hari.

# 8. Model Data (High-Level)

| **Entitas**            | **Field Utama**                                                                                                                                                                                                         | **Keterangan**                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **users**              | `id`, `username`, `password_hash`, `role`, `created_at`, `updated_at`                                                                                                                                                   | Akun user global Runmail; tidak dimiliki tenant/workspace terpisah.                       |
| **domains**            | `id`, `domain_name`, `verification_status`, `created_at`, `updated_at`                                                                                                                                                  | Domain Cloudflare yang tersedia untuk mailbox Runmail.                                    |
| **mailboxes**          | `id`, `domain_id`, `local_part`, `is_active`, `created_at`, `updated_at`                                                                                                                                                | Unit tenant/boundary isolasi data. Constraint unik global pada `(domain_id, local_part)`. |
| **mailbox_users**      | `id`, `mailbox_id`, `user_id`, `created_at`                                                                                                                                                                             | Relasi many-to-many user global dan mailbox.                                              |
| **folders**            | `id`, `mailbox_id`, `name`, `folder_type`, `created_at`, `updated_at`                                                                                                                                                   | Folder system/custom yang terisolasi per mailbox.                                         |
| **messages**           | `id`, `mailbox_id`, `internet_message_id`, `from_address`, `subject`, `snippet`, `email_date`, `received_at`, `is_read`, `is_starred`, `folder_id`, `folder_entered_at`, `raw_object_key`, `sync_version`, `updated_at` | Metadata/index message milik satu mailbox.                                                |
| **message_recipients** | `id`, `message_id`, `recipient_type`, `email_address`                                                                                                                                                                   | Recipient metadata untuk message.                                                         |
| **rulesets**           | `id`, `mailbox_id`, `name`, `priority`, `logic_operator`, `is_enabled`, `created_at`, `updated_at`                                                                                                                      | Ruleset milik satu mailbox.                                                               |
| **ruleset_conditions** | `id`, `ruleset_id`, `field`, `match_type`, `condition_value`, `condition_order`                                                                                                                                         | Condition non-JSON.                                                                       |
| **ruleset_actions**    | `id`, `ruleset_id`, `action_type`, `action_value`, `action_order`                                                                                                                                                       | Action non-JSON.                                                                          |
| **sync_events**        | `sync_version`, `mailbox_id`, `event_type`, `message_id`, `created_at`                                                                                                                                                  | Delta/change log yang terisolasi per mailbox dan dipertahankan 30 hari.                   |
| **refresh_tokens**     | `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`                                                                                                                                                 | Refresh token/session user global.                                                        |

**Catatan:** model ini high-level. Index, constraint detail, strategi sequence `sync_version`, dan kompensasi lintas D1/R2 ditentukan pada technical design.

# 9. Kebutuhan Non-Fungsional (Non-Functional Requirements)

- **Performa :** metadata inbox dibaca dari IndexedDB dan sinkronisasi hanya mengambil delta.
- **Responsivitas :** read/star/move menggunakan optimistic UI.
- **Responsive Web :** fungsi utama harus nyaman digunakan pada desktop dan mobile.
- **Browser :** mendukung stable release terbaru Chrome, Firefox, Microsoft Edge, dan browser modern relevan pada saat rilis.
- **Efisiensi Jaringan :** raw `.eml` di-fetch on-demand.
- **Ketahanan Koneksi :** mutation queue mendukung retry setelah koneksi tersedia.
- **Konsistensi :** `sync_version` dan server-ordered last-write-wins digunakan untuk perubahan state.
- **Keamanan :** API menggunakan Bearer JWT; refresh token mendukung rotation dan revocation.
- **Isolasi Mailbox :** mailbox merupakan tenant boundary; akses message, folder, ruleset, dan sync state/event dibatasi berdasarkan relasi `mailbox_users`.
- **Privasi Perangkat :** IndexedDB dan Cache API dibersihkan saat logout.
- **Retensi :** Trash/Spam 30 hari; folder lain sampai user menghapus message.
- **Storage :** tidak ada quota aplikasi pada MVP.
- **Integritas Ingest :** kegagalan D1/R2 menyebabkan reject dan cleanup partial write.
- **Ukuran Pesan :** maksimum 25 MB.
- **Raw Email :** RFC-822 disimpan tanpa modifikasi dan tanpa enkripsi aplikasi tambahan.

# 10. Integrasi Pihak Ketiga

| **Layanan**                                  | **Fungsi**                                  | **Catatan**  |
| -------------------------------------------- | ------------------------------------------- | ------------ |
| **Cloudflare Workers**                       | Backend API dan email processing.           | MVP.         |
| **Cloudflare Email Service / Email Routing** | Penerimaan dan routing email.               | MVP.         |
| **Cloudflare R2**                            | Raw RFC-822 storage.                        | MVP.         |
| **Cloudflare D1**                            | Metadata/index/state/sync storage.          | MVP.         |
| **Cloudflare Cron Triggers**                 | Cleanup Trash/Spam harian.                  | MVP.         |
| **Cloudflare domain/DNS data**               | Validasi domain dan kesiapan email routing. | MVP.         |
| **Vue 3**                                    | Frontend.                                   | MVP.         |
| **Dexie.js / IndexedDB**                     | Metadata lokal.                             | MVP.         |
| **Cache API**                                | Raw `.eml` lokal.                           | MVP.         |
| **postal-mime**                              | Parsing MIME client-side.                   | MVP.         |
| **Drizzle ORM**                              | Adapter D1.                                 | MVP.         |
| **Bun**                                      | Runtime/tooling development JavaScript.     | Development. |

# 11. Fitur Usulan / Fase Lanjutan

- **Spam Detection.** Mekanisme deteksi spam otomatis akan dibahas setelah MVP. Folder system Spam tetap tersedia sejak MVP.
- **Mailbox Storage Metering & Quota.** MVP tidak menerapkan quota aplikasi. Metering dan pembatasan storage mailbox akan ditambahkan pada fase lanjutan.

# 12. Pertanyaan Terbuka / TBD

- Nama domain utama SaaS Runmail dan konfigurasi brand/domain operasional belum ditentukan.
- Timeline pengembangan dan target tanggal rilis MVP belum ditentukan.
- Detail teknis konfigurasi/verifikasi Cloudflare Email Routing dan record DNS yang diperiksa perlu ditentukan pada technical design.
- Algoritma hashing password final yang kompatibel dengan runtime backend belum ditetapkan.
- Detail schema/index D1, pembangkitan monotonic `sync_version`, dan strategi cleanup/kompensasi D1–R2 perlu ditentukan pada technical design.
- Batas biaya/operasional Cloudflare Workers, D1, R2, dan Email Service pada skala produksi belum ditentukan.
- UX admin ketika kombinasi `(domain, local_part)` sudah digunakan mailbox lain perlu ditentukan.

## 12.1 Acceptance Criteria MVP Tingkat Modul

- **Authentication & Session :** kredensial valid menghasilkan access token 15 menit dan refresh token 30 hari; refresh melakukan rotation; logout me-revoke session aktif dan membersihkan storage lokal.
- **Domain/Mailbox :** mailbox hanya dapat dibuat pada domain `active`; mailbox menjadi unit tenant; `(domain, local_part)` tidak dapat diduplikasi; user hanya dapat mengakses mailbox yang terhubung kepadanya melalui `mailbox_users`.
- **Email Ingest :** email valid ≤25 MB diproses ruleset dan disimpan ke R2+D1; oversized, local-part invalid, no-rule-match, atau write failure di-reject.
- **Ruleset :** AND/OR satu tingkat, priority, action order, field/match type yang disepakati, dan multiple match menghasilkan output deterministik.
- **Inbox/Folder :** detail, read/unread, star/unstar, move, Trash, permanent delete, move, dan custom folder dapat digunakan; system folder tidak dapat dimodifikasi.
- **Delta Sync :** perubahan tersinkron dengan `sync_version`; cursor expired menghasilkan `full_resync_required`; optimistic mutation dapat retry/rollback.
- **Raw Email :** `.eml` diambil on-demand, dicache, diparse `postal-mime`, dan dapat dibaca ulang tanpa network selama cache tersedia.
- **Search/Pagination :** search metadata lokal mendukung query umum dan `from:`, `to:`, `subject:`; pagination cursor default 10 message.
- **Retention :** Trash/Spam terhapus otomatis setelah 30 hari sejak terakhir masuk folder dan mendukung permanent delete manual.
- **Responsive UI :** fungsi utama inbox dapat digunakan pada desktop/mobile melalui stable browser modern yang didukung.

# 13. Glosarium

- **Runmail :** nama produk SaaS email inbox.
- **Tenant :** konsep tenancy Runmail yang direpresentasikan langsung oleh mailbox; tidak ada entitas tenant terpisah.
- **Mailbox :** kotak email dengan satu alamat unik `(domain + local_part)` sekaligus unit tenant/boundary isolasi data Runmail.
- **Mailbox User :** relasi yang memberikan user akses ke mailbox tertentu.
- **Local-part :** bagian alamat email sebelum `@`.
- **Delta Sync :** sinkronisasi yang hanya mengirim perubahan sejak cursor terakhir.
- **Sync Version :** nomor urut monotonik backend untuk mengurutkan perubahan.
- **Tombstone :** event penanda permanent deletion agar client lain dapat menghapus salinan lokal.
- **Full Resync :** pembangunan ulang metadata lokal ketika cursor delta sudah kedaluwarsa.
- **Raw Email / RFC-822 :** representasi lengkap email yang disimpan tanpa modifikasi.
- **R2 :** Cloudflare object storage untuk raw email.
- **D1 :** Cloudflare database untuk metadata/index/state.
- **IndexedDB :** database browser untuk metadata lokal.
- **Dexie.js :** library pengelolaan IndexedDB.
- **Cache API :** storage browser untuk raw `.eml`.
- **Ruleset :** condition dan action untuk memfilter email sebelum penyimpanan.
- **Optimistic UI :** perubahan UI/state lokal sebelum konfirmasi backend.
- **Sync Queue :** antrean mutation lokal untuk dikirim ke backend.
- **Bearer JWT :** access-token authentication pada API.
- **Refresh Token Rotation :** penggantian refresh token setiap proses refresh.
- **Cron Trigger :** scheduler Cloudflare untuk cleanup harian.
- **postal-mime :** parser MIME JavaScript untuk raw email.
- **Hono :** framework backend.
- **Vue 3 :** framework frontend.
- **Drizzle ORM :** ORM/adapter akses D1.

---

_Dokumen ini merupakan draft sementara v0.5 dan telah diperbarui berdasarkan keputusan klarifikasi produk hingga 31 Agustus 2026._
