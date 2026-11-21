import type { Context } from "hono";

export type AuthUser = { user_id: string; role: string };

export type MailboxAccess = { mailbox_id: string };

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: { auth: AuthUser; mailbox: MailboxAccess; request_id: string };
};

declare module "hono" {
  interface ContextVariableMap {
    request_id: string;
  }
}

export type AppContext = Context<AppEnv>;

export function validateEnv(_env: CloudflareBindings): void {
  // No required secrets: auth uses RS256 keypair stored in settings table.
}
