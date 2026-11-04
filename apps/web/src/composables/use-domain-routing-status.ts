import { ApiError } from "@/lib/api";
import { cloudflareClient } from "@/lib/cloudflare-client";
import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";

export type DnsStatusKey =
  "ready" | "unconfigured" | "misconfigured" | "misconfigured/locked" | "unlocked";

export interface DomainRoutingState {
  status: "idle" | "loading" | "ready" | "error";
  enabled: boolean | null;
  dns: DnsStatusKey | null;
  error: string;
}

const IDLE: DomainRoutingState = { status: "idle", enabled: null, dns: null, error: "" };

/**
 * Per-domain Email Routing status via `emailRouting.get({ zone_id })`.
 * Domain.id is the Cloudflare zone id - no lookup needed.
 * Serial fetch (one zone at a time) to stay kind to rate limits.
 */
export function useDomainRoutingStatus(
  canFetch: Ref<boolean> | (() => boolean),
  onAuthReset?: (err: unknown) => boolean,
) {
  const { t } = useI18n();
  const states = ref(new Map<string, DomainRoutingState>());
  let revision = 0;

  function get(id: string): DomainRoutingState {
    return states.value.get(id) ?? { ...IDLE };
  }

  async function fetchOne(id: string, current: number): Promise<void> {
    states.value.set(id, { status: "loading", enabled: null, dns: null, error: "" });
    try {
      const settings = await cloudflareClient.emailRouting.get({ zone_id: id });
      if (current !== revision) return;
      states.value.set(id, {
        status: "ready",
        enabled: settings.enabled,
        dns: (settings.status as DnsStatusKey | undefined) ?? null,
        error: "",
      });
    } catch (err) {
      if (current !== revision) return;
      if (onAuthReset?.(err)) return;
      states.value.set(id, {
        status: "error",
        enabled: null,
        dns: null,
        error: err instanceof ApiError ? err.message : t("admin.domains.routingStatus.loadError"),
      });
    }
  }

  async function refresh(ids: string[]): Promise<void> {
    const current = ++revision;
    const allowed = typeof canFetch === "function" ? canFetch() : canFetch.value;
    // Always reset so stale statuses never linger across list changes.
    states.value = new Map(ids.map((id) => [id, { ...IDLE }]));
    if (!allowed) return;
    for (const id of ids) {
      if (current !== revision) return;
      await fetchOne(id, current);
    }
  }

  function retry(id: string): void {
    const allowed = typeof canFetch === "function" ? canFetch() : canFetch.value;
    if (!allowed) return;
    void fetchOne(id, revision);
  }

  return { states, get, refresh, retry };
}
