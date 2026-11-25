import { ApiError } from "@/lib/api";
import { cloudflareClient } from "@/lib/cloudflare-client";
import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";

export interface DomainSubdomain {
  id: string;
  name: string;
  enabled: boolean | null;
  status: string | null;
}

export interface WorkerOption {
  id: string;
  name: string;
}

export interface DomainSettingsState {
  status: "idle" | "loading" | "ready" | "error";
  /** Active catch-all worker name, "" when none/drop. */
  catchAllWorker: string;
  catchAllEnabled: boolean | null;
  catchAllBusy: boolean;
  subaddressEnabled: boolean | null;
  subaddressBusy: boolean;
  subdomains: DomainSubdomain[];
  subdomainsBusy: boolean;
  workers: WorkerOption[];
  /** Inline worker-list failure; routing sections still render. */
  workersError: string;
  error: string;
}

interface ScriptPageShape {
  result?: Array<{ id?: unknown; name?: unknown; handlers?: unknown }>;
}

interface ZoneShape {
  owner?: { id?: unknown };
}
function toWorkerOptions(page: unknown): WorkerOption[] {
  const result = (page as ScriptPageShape | null | undefined)?.result;
  if (!Array.isArray(result)) return [];
  const options: WorkerOption[] = [];
  for (const item of result) {
    if (typeof item?.id !== "string" || !item.id) continue;
    if (!Array.isArray(item.handlers) || !item.handlers.includes("email")) continue;
    options.push({
      id: item.id,
      name: typeof item.name === "string" && item.name ? item.name : item.id,
    });
  }
  return options;
}
interface EmailRoutingSettingsShape {
  support_subaddress?: unknown;
  subdomains?: unknown;
}

interface SubdomainEntryShape {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  status?: unknown;
}

function toSubdomains(settings: EmailRoutingSettingsShape): DomainSubdomain[] {
  if (!Array.isArray(settings.subdomains)) return [];
  const out: DomainSubdomain[] = [];
  for (const entry of settings.subdomains as SubdomainEntryShape[]) {
    if (typeof entry?.name !== "string" || !entry.name) continue;
    out.push({
      id: typeof entry.id === "string" && entry.id ? entry.id : entry.name,
      name: entry.name,
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : null,
      status: typeof entry.status === "string" ? entry.status : null,
    });
  }
  return out;
}

function supportSubaddressOf(settings: EmailRoutingSettingsShape): boolean | null {
  return typeof settings.support_subaddress === "boolean" ? settings.support_subaddress : null;
}

const IDLE: DomainSettingsState = {
  status: "idle",
  catchAllWorker: "",
  catchAllEnabled: null,
  catchAllBusy: false,
  subaddressEnabled: null,
  subaddressBusy: false,
  subdomains: [],
  subdomainsBusy: false,
  workers: [],
  workersError: "",
  error: "",
};
/**
 * Per-domain Email Routing settings: catch-all worker rule, subaddressing
 * toggle, and routing subdomains. Domain.id is the Cloudflare zone id.
 */
export function useDomainSettings(
  canFetch: Ref<boolean> | (() => boolean),
  onAuthReset?: (err: unknown) => boolean,
) {
  const { t } = useI18n();
  const states = ref(new Map<string, DomainSettingsState>());
  let revision = 0;

  function get(id: string): DomainSettingsState {
    return states.value.get(id) ?? { ...IDLE, subdomains: [], workers: [], workersError: "" };
  }

  function set(id: string, patch: Partial<DomainSettingsState>): DomainSettingsState {
    const next = { ...get(id), ...patch };
    states.value.set(id, next);
    return next;
  }

  function fail(id: string, current: number, err: unknown): boolean {
    if (current !== revision) return false;
    if (onAuthReset?.(err)) return true;
    set(id, {
      status: "error",
      error: err instanceof ApiError ? err.message : t("admin.domains.settings.loadError"),
    });
    return true;
  }

  function allowed(): boolean {
    return typeof canFetch === "function" ? canFetch() : canFetch.value;
  }

  async function refreshSubdomains(id: string): Promise<DomainSubdomain[]> {
    const settings = (await cloudflareClient.emailRouting.get({
      zone_id: id,
    })) as EmailRoutingSettingsShape;
    const subdomains = toSubdomains(settings);
    set(id, { subdomains });
    return subdomains;
  }

  async function loadSettings(id: string): Promise<void> {
    const current = ++revision;
    if (!allowed()) {
      states.value.set(id, { ...IDLE, subdomains: [], workers: [], workersError: "" });
      return;
    }
    set(id, { status: "loading", error: "", workersError: "" });
    try {
      const [zone, settings, catchAll] = await Promise.all([
        cloudflareClient.zones.get({ zone_id: id }),
        cloudflareClient.emailRouting.get({ zone_id: id }),
        cloudflareClient.emailRouting.rules.catchAlls.get({ zone_id: id }),
      ]);
      if (current !== revision) return;
      const shape = settings as EmailRoutingSettingsShape;
      const action = catchAll.actions?.[0];
      set(id, {
        status: "ready",
        catchAllWorker: action?.type === "worker" ? (action.value?.[0] ?? "") : "",
        catchAllEnabled: catchAll.enabled ?? null,
        subaddressEnabled: supportSubaddressOf(shape),
        subdomains: toSubdomains(shape),
        error: "",
      });
      // Workers need the account id from the zone account id; load after the routing
      // data so the dialog already shows server state when workers fail.
      try {
        const accountId = zone?.account?.id;
        if (typeof accountId !== "string" || !accountId) {
          if (current !== revision) return;
          set(id, { workers: [], workersError: t("admin.domains.settings.loadError") });
          return;
        }
        const page = await cloudflareClient.workers.scripts.list({ account_id: accountId });
        if (current !== revision) return;
        const options = toWorkerOptions(page);
        // Keep the active worker selectable even when it lacks the email handler flag.
        const active = get(id).catchAllWorker;
        if (active && !options.some((o) => o.id === active || o.name === active)) {
          options.unshift({ id: active, name: active });
        }
        set(id, { workers: options, workersError: "" });
      } catch (err) {
        if (current !== revision) return;
        if (onAuthReset?.(err)) return;
        // Routing data already rendered; worker dropdown just stays empty.
        set(id, {
          workers: [],
          workersError:
            err instanceof ApiError ? err.message : t("admin.domains.settings.loadError"),
        });
      }
    } catch (err) {
      fail(id, current, err);
    }
  }

  function retry(id: string): void {
    if (allowed()) void loadSettings(id);
  }

  async function updateCatchAll(id: string, workerName: string): Promise<boolean> {
    if (!allowed()) return false;
    const current = revision;
    set(id, { catchAllBusy: true });
    try {
      const updated = await cloudflareClient.emailRouting.rules.catchAlls.update({
        zone_id: id,
        matchers: [{ type: "all" }],
        actions: [{ type: "worker", value: [workerName] }],
        enabled: true,
      });
      if (current !== revision) return true;
      const action = updated.actions?.[0];
      set(id, {
        catchAllBusy: false,
        catchAllWorker: action?.type === "worker" ? (action.value?.[0] ?? workerName) : workerName,
        catchAllEnabled: updated.enabled ?? true,
      });
      return true;
    } catch (err) {
      if (current !== revision) return false;
      set(id, { catchAllBusy: false });
      if (onAuthReset?.(err)) return false;
      set(id, {
        status: "error",
        error: err instanceof ApiError ? err.message : t("admin.domains.settings.updateError"),
      });
      return false;
    }
  }

  async function updateSubaddress(id: string, enabled: boolean): Promise<boolean> {
    if (!allowed()) return false;
    const current = revision;
    const previous = get(id).subaddressEnabled;
    set(id, { subaddressBusy: true, subaddressEnabled: enabled });
    try {
      const updated = await cloudflareClient.emailRouting.update({
        zone_id: id,
        support_subaddress: enabled,
      });
      if (current !== revision) return true;
      const shape = updated as EmailRoutingSettingsShape;
      set(id, {
        subaddressBusy: false,
        subaddressEnabled: supportSubaddressOf(shape) ?? enabled,
      });
      return true;
    } catch (err) {
      if (current !== revision) return false;
      set(id, { subaddressBusy: false, subaddressEnabled: previous });
      if (onAuthReset?.(err)) return false;
      set(id, {
        status: "error",
        error: err instanceof ApiError ? err.message : t("admin.domains.settings.updateError"),
      });
      return false;
    }
  }

  async function addSubdomain(id: string, name: string): Promise<boolean> {
    if (!allowed()) return false;
    const current = revision;
    set(id, { subdomainsBusy: true });
    try {
      await cloudflareClient.emailRouting.dns.create({ zone_id: id, name });
      if (current !== revision) return true;
      await refreshSubdomains(id);
      if (current !== revision) return true;
      set(id, { subdomainsBusy: false });
      return true;
    } catch (err) {
      if (current !== revision) return false;
      set(id, { subdomainsBusy: false });
      if (onAuthReset?.(err)) return false;
      set(id, {
        status: "error",
        error: err instanceof ApiError ? err.message : t("admin.domains.settings.updateError"),
      });
      return false;
    }
  }

  async function removeSubdomain(id: string, name: string): Promise<boolean> {
    if (!allowed()) return false;
    const current = revision;
    set(id, { subdomainsBusy: true });
    try {
      await cloudflareClient.emailRouting.dns.delete({ zone_id: id }, { body: { name } });
      if (current !== revision) return true;
      await refreshSubdomains(id);
      if (current !== revision) return true;
      set(id, { subdomainsBusy: false });
      return true;
    } catch (err) {
      if (current !== revision) return false;
      set(id, { subdomainsBusy: false });
      if (onAuthReset?.(err)) return false;
      set(id, {
        status: "error",
        error:
          err instanceof ApiError || err instanceof Error
            ? err.message
            : t("admin.domains.settings.updateError"),
      });
      return false;
    }
  }

  return {
    states,
    get,
    loadSettings,
    retry,
    updateCatchAll,
    updateSubaddress,
    addSubdomain,
    removeSubdomain,
  };
}
