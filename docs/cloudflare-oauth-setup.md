# Cloudflare OAuth Setup Guide

Runmail menggunakan Cloudflare OAuth 2.0 untuk mengakses domain dan email routing settings di akun Cloudflare Anda.

## Prerequisites

- Akun Cloudflare dengan minimal 1 zone (domain)
- Akses admin ke dashboard Cloudflare

---

## 1. Create Cloudflare OAuth Application

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Pergi ke **My Profile** → **API Tokens** → **OAuth Applications**
3. Klik **Create Application**

### Application Settings

**Application Name:** `Runmail`

**Redirect URIs:**
```
https://your-domain.com/admin/domains/integration
```
*Ganti `your-domain.com` dengan domain Runmail Anda*

**For development:**
```
http://localhost:8787/admin/domains/integration
```

**Grant Types:**
- ✅ Authorization Code
- ✅ Refresh Token

**Scopes (Required):**
- ✅ `account.read` — Account Read
- ✅ `zone.read` — Zone Read
- ✅ `zone_settings.read` — Zone Settings Read
- ✅ `email_routing_rules.read` — Email Routing Rules Read

4. Klik **Create Application**
5. Simpan **Client ID** dan **Client Secret** (hanya muncul sekali)

---

## 2. Configure Worker Environment

### Development (.dev.vars)

Buat file `apps/worker/.dev.vars`:

```bash
CLOUDFLARE_OAUTH_CLIENT_ID=your_client_id_here
CLOUDFLARE_OAUTH_CLIENT_SECRET=your_client_secret_here
```

### Production (Wrangler Secrets)

```bash
cd apps/worker

# Set OAuth credentials as secrets
wrangler secret put CLOUDFLARE_OAUTH_CLIENT_ID
# Paste your Client ID when prompted

wrangler secret put CLOUDFLARE_OAUTH_CLIENT_SECRET
# Paste your Client Secret when prompted
```

**Note:** OAuth credentials are stored as secrets, NOT in `wrangler.jsonc` vars.

---

## 3. Run Database Migration

Jalankan migration untuk membuat `settings` table:

```bash
cd apps/worker
wrangler d1 migrations apply DB
```

Migration yang dijalankan:
- `0002_lean_iceman.sql` — Creates `settings` table

---

## 4. Connect Cloudflare OAuth (Admin)

1. Login sebagai admin ke Runmail
2. Pergi ke **Domain Management** page
3. Klik tombol **"Connect Cloudflare"** di alert banner
4. Authorize akses di Cloudflare dashboard
5. Kamu akan di-redirect kembali ke Runmail
6. OAuth token tersimpan otomatis

---

## 5. Verify Connection

Setelah OAuth terhubung:

- Alert banner **"Connect Cloudflare"** akan hilang
- Domain operations (list available zones, verify domain) akan bekerja
- Access token di-refresh otomatis setiap kali expired

---

## Troubleshooting

### Error: "Cloudflare OAuth belum dikonfigurasi"

**Penyebab:** OAuth token belum tersimpan di database.

**Solusi:**
1. Pastikan env vars sudah di-set (`CLOUDFLARE_OAUTH_CLIENT_ID`, `CLOUDFLARE_OAUTH_CLIENT_SECRET`)
2. Lakukan OAuth connection via UI (step 4 di atas)

### Error: "Token exchange failed"

**Penyebab:** Client ID/Secret salah, atau redirect URI tidak match.

**Solusi:**
1. Cek Client ID/Secret di Cloudflare dashboard
2. Pastikan redirect URI di OAuth app match dengan domain Runmail Anda
3. Format redirect URI: `https://your-domain.com/api/v1/admin/cloudflare/oauth/callback`

### Error: "Invalid or expired state parameter"

**Penyebab:** OAuth state JWT expired (>5 menit antara authorize dan callback).

**Solusi:**
1. Coba lagi OAuth flow dari awal
2. Authorize lebih cepat di Cloudflare dashboard

### Domain operations suddenly fail

**Penyebab:** Refresh token revoked atau expired.

**Solusi:**
1. Reconnect OAuth via UI (alert banner akan muncul)
2. Cek di Cloudflare dashboard apakah OAuth app masih aktif

---

## Migration from API Token (Legacy)

Jika sebelumnya menggunakan `CLOUDFLARE_API_TOKEN`:

### 1. Remove Old Secrets

```bash
cd apps/worker
wrangler secret delete CLOUDFLARE_API_TOKEN
```

### 2. Add New OAuth Secrets

```bash
wrangler secret put CLOUDFLARE_OAUTH_CLIENT_ID
wrangler secret put CLOUDFLARE_OAUTH_CLIENT_SECRET
```

### 3. Run Migration

```bash
wrangler d1 migrations apply DB
```

### 4. Connect OAuth

Follow step 4 di atas untuk connect OAuth via UI.

**Note:** Setelah OAuth terhubung, semua domain operations akan otomatis menggunakan OAuth access token.

---

## Security Notes

- **Refresh token** disimpan di D1 database (encrypted at rest by Cloudflare)
- **Access token** di-cache di Worker memory (tidak persisted, 1-hour TTL)
- **Client secret** stored as Wrangler secret (tidak di-commit ke Git)
- OAuth state menggunakan JWT signature untuk CSRF protection
- Token auto-cleared jika revoked/invalid

---

## API Endpoints (Admin Only)

**Check Status:**
```bash
GET /api/v1/admin/cloudflare/oauth/status
Authorization: Bearer <admin_access_token>
```

**Initiate OAuth:**
```bash
POST /api/v1/admin/cloudflare/oauth/authorize
Authorization: Bearer <admin_access_token>
```

**Disconnect OAuth:**
```bash
DELETE /api/v1/admin/cloudflare/oauth/disconnect
Authorization: Bearer <admin_access_token>
```

---

## Support

Jika masih ada masalah, check:
1. Worker logs: `wrangler tail`
2. D1 database: `wrangler d1 execute DB --command "SELECT * FROM settings WHERE name='CLOUDFLARE_OAUTH_TOKEN'"`
3. Cloudflare OAuth app settings di dashboard
