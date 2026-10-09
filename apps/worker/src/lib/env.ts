import type { Context } from "hono";
import type { Bindings } from "./db";

export type AuthUser = { user_id: string; role: string };

export type MailboxAccess = { mailbox_id: string };

export type AppEnv = {
  Bindings: Bindings;
  Variables: { auth: AuthUser; mailbox: MailboxAccess; request_id: string };
};

declare module "hono" {
  interface ContextVariableMap {
    request_id: string;
  }
}

export type AppContext = Context<AppEnv>;

export function validateEnv(env: Bindings): void {
  // Note: 64+ characters (256-bit) recommended for production
  if (!env.JWT_SIGNING_SECRET || env.JWT_SIGNING_SECRET.length < 32) {
    throw new Error("JWT_SIGNING_SECRET must be at least 32 characters");
  }
}
