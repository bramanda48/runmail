/**
 * Mirrors the `domains` D1 table for API payloads.
 */
export interface Domain {
  id: string;
  domain_name: string;
  created_at: number;
  updated_at: number;
}
