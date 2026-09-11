import type { Role } from "./role";

/**
 * Application user. Mirrors the `users` D1 table for API payloads.
 * Never includes the password hash.
 */
export interface User {
  id: string;
  username: string;
  role: Role;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}
