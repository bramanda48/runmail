# Security Notes

## Historical Credential Exposure

**CLOUDFLARE_ACCOUNT_ID Exposure:**

- Commits `a2e0c43` and `c243695` contain a hardcoded Cloudflare account ID
- This credential is permanently in git history
- The account ID is now managed via environment variables (`.dev.vars` for local, `wrangler secret` for production)
- Current configuration excludes `wrangler.jsonc` via `.gitignore` to prevent future exposure

**Mitigation:**

- Account ID has been rotated/invalidated (if applicable)
- OR: Account ID exposure is accepted as low-risk (read-only identifier)
- Future secrets must never be committed to git
