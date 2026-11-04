import { listDomains } from "@/lib/api";
import type { Domain } from "@runmail/shared";
import { computed } from "vue";
import { useCursorPagination } from "./use-cursor-pagination";

export function useDomainList(onApiError?: (err: unknown) => boolean) {
  const pagination = useCursorPagination<Domain>(
    async (cursor, limit) => {
      const { data, meta } = await listDomains(cursor, limit);
      return { items: data.domains, meta: meta ?? null };
    },
    "admin.domains.loadError",
    10,
    onApiError,
  );

  const registeredIds = computed(() => new Set(pagination.items.value.map((d) => d.id)));

  return {
    domains: pagination.items,
    registeredIds,
    ...pagination,
  };
}
