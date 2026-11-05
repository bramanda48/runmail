import { ApiError } from "@/lib/api";
import { cloudflareClient } from "@/lib/cloudflare-client";
import { checkDnsGroupViaDoh, unchunkDnsValue } from "@/lib/doh-verify";
import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";

export type DnsVerifyStatus = "pending" | "checking" | "correct" | "incorrect" | "error";
export type DnsGroupKind = "mx" | "spf" | "dkim";

export interface DnsGroupItem {
  kind: DnsGroupKind;
  expected: string;
  detected: string;
  queryType: string;
  queryNames: string[];
  status: DnsVerifyStatus;
  error: string;
}

export interface DomainDnsState {
  status: "idle" | "loading" | "ready" | "error";
  groups: DnsGroupItem[];
  error: string;
}

const IDLE: DomainDnsState = { status: "idle", groups: [], error: "" };

interface ProxyRecord {
  type?: string;
  name?: string;
  content?: string;
}

function buildGroups(records: ProxyRecord[], domainName: string): DnsGroupItem[] {
  const mxContents: string[] = [];
  const mxNames: string[] = [];
  const spfContents: string[] = [];
  const spfNames: string[] = [];
  const dkimContents: string[] = [];
  const dkimNames: string[] = [];
  const pushUnique = (list: string[], value: string): void => {
    if (!list.includes(value)) list.push(value);
  };
  for (const rec of records) {
    const type = (rec.type ?? "").toUpperCase();
    const content = rec.content ?? "";
    const rawName = rec.name ?? "";
    const queryName = rawName === "@" ? domainName : rawName;
    if (type === "MX") {
      mxContents.push(content);
      pushUnique(mxNames, queryName);
    } else if (type === "TXT") {
      if (content.includes("v=spf1")) {
        spfContents.push(content);
        pushUnique(spfNames, queryName);
      } else if (content.includes("v=DKIM1")) {
        dkimContents.push(content);
        pushUnique(dkimNames, queryName);
      }
    }
  }
  const makeGroup = (
    kind: DnsGroupKind,
    contents: string[],
    names: string[],
    queryType: string,
  ): DnsGroupItem => ({
    kind,
    expected: contents.join("\n"),
    detected: "",
    queryType,
    queryNames: contents.length === 0 ? [] : names,
    status: contents.length === 0 ? "incorrect" : "pending",
    error: "",
  });
  return [
    makeGroup("mx", mxContents, mxNames, "MX"),
    makeGroup("spf", spfContents, spfNames, "TXT"),
    makeGroup("dkim", dkimContents, dkimNames, "TXT"),
  ];
}

function setItem(
  states: Ref<Map<string, DomainDnsState>>,
  id: string,
  index: number,
  patch: Partial<DnsGroupItem>,
): void {
  const state = states.value.get(id);
  if (!state) return;
  const item = state.groups[index];
  if (!item) return;
  const groups = state.groups.slice();
  groups[index] = { ...item, ...patch };
  states.value.set(id, { ...state, groups });
}

/**
 * Per-domain DNS verification records via `emailRouting.dns.get({ zone_id })`.
 * Domain.id is the Cloudflare zone id - no lookup needed.
 * Serial verify (one record at a time) to stay kind to rate limits.
 */
export function useDomainDnsRecords(
  canFetch: Ref<boolean> | (() => boolean),
  onAuthReset?: (err: unknown) => boolean,
) {
  const { t } = useI18n();
  const states = ref(new Map<string, DomainDnsState>());
  const revisions = new Map<string, number>();

  function get(domainId: string): DomainDnsState {
    return states.value.get(domainId) ?? { ...IDLE, groups: [] };
  }

  function isExpanded(domainId: string): boolean {
    return states.value.has(domainId);
  }

  function collapse(domainId: string): void {
    revisions.set(domainId, (revisions.get(domainId) ?? 0) + 1);
    states.value.delete(domainId);
  }

  async function verifyItem(domainId: string, index: number, current: number): Promise<void> {
    const existing = states.value.get(domainId)?.groups[index];
    if (!existing || existing.queryNames.length === 0 || existing.expected === "") return;
    setItem(states, domainId, index, { status: "checking", error: "" });
    const state = states.value.get(domainId);
    const item = state?.groups[index];
    if (!item) return;
    const parts = item.expected.split("\n");
    try {
      const { found, answers } = await checkDnsGroupViaDoh(item.queryNames, item.queryType, parts);
      if (current !== revisions.get(domainId)) return;
      setItem(states, domainId, index, {
        status: found ? "correct" : "incorrect",
        detected: answers.map((a) => unchunkDnsValue(a)).join("\n"),
      });
    } catch {
      if (current !== revisions.get(domainId)) return;
      setItem(states, domainId, index, { status: "error" });
    }
  }

  async function toggle(domain: { id: string }, domainName: string): Promise<void> {
    if (isExpanded(domain.id)) {
      collapse(domain.id);
      return;
    }
    const allowed = typeof canFetch === "function" ? canFetch() : canFetch.value;
    if (!allowed) {
      states.value.set(domain.id, { ...IDLE, groups: [] });
      return;
    }
    const current = (revisions.get(domain.id) ?? 0) + 1;
    revisions.set(domain.id, current);
    states.value.set(domain.id, { status: "loading", groups: [], error: "" });
    try {
      const res = (await cloudflareClient.emailRouting.dns.get({
        zone_id: domain.id,
      })) as unknown as ProxyRecord[] | { result?: ProxyRecord[] };
      if (current !== revisions.get(domain.id)) return;
      const records = Array.isArray(res) ? res : (res.result ?? []);
      const groups = buildGroups(records, domainName);
      states.value.set(domain.id, { status: "ready", groups, error: "" });
    } catch (err) {
      if (current !== revisions.get(domain.id)) return;
      if (onAuthReset?.(err)) {
        states.value.delete(domain.id);
        return;
      }
      states.value.set(domain.id, {
        status: "error",
        groups: [],
        error: err instanceof ApiError ? err.message : t("admin.domains.dnsRecords.error"),
      });
      return;
    }
    const state = states.value.get(domain.id);
    if (!state) return;
    for (let i = 0; i < state.groups.length; i++) {
      if (current !== revisions.get(domain.id)) return;
      await verifyItem(domain.id, i, current);
    }
  }

  function retryRecord(domainId: string, index: number): void {
    const allowed = typeof canFetch === "function" ? canFetch() : canFetch.value;
    if (!allowed) return;
    const current = revisions.get(domainId) ?? 0;
    void verifyItem(domainId, index, current);
  }

  return { get, toggle, retryRecord, isExpanded, collapse };
}
