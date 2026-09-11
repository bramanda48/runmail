export type DomainVerificationStatus = "pending_verification" | "active";

/**
 * Mirrors the `domains` D1 table for API payloads.
 */
export interface Domain {
  id: string;
  domain_name: string;
  verification_status: DomainVerificationStatus;
  created_at: number;
  updated_at: number;
}

export interface VerifyDomainResponse {
  domain: Domain;
  cf_status: string | null;
  verification_checked: boolean;
  reason?: string;
}
