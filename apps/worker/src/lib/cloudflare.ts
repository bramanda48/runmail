export class CloudflareOAuthNotConfiguredError extends Error {
  constructor() {
    super("CLOUDFLARE_OAUTH_NOT_CONFIGURED");
    this.name = "CloudflareOAuthNotConfiguredError";
  }
}
