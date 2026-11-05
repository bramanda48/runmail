import { ApiError } from "@/lib/api";
import type { ApiMeta } from "@runmail/shared";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

export interface CursorPageFetcher<T> {
  (cursor: string | undefined, limit: number): Promise<{ items: T[]; meta: ApiMeta | null }>;
}

export function useCursorPagination<T>(
  fetcher: CursorPageFetcher<T>,
  loadErrorKey: string,
  perPage = 10,
  onApiError?: (err: unknown) => boolean,
) {
  const { t } = useI18n();

  const items = ref<T[]>([]);
  const meta = ref<ApiMeta | null>(null);
  const cursors = ref<(string | undefined)[]>([undefined]);
  const pageIndex = ref(0);
  const isLoading = ref(false);
  const error = ref("");

  const page = computed(() => pageIndex.value + 1);
  const start = computed(() => pageIndex.value * perPage + 1);
  const end = computed(() => start.value + items.value.length - 1);
  const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);
  const paginationTotal = computed(() =>
    meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage,
  );

  async function load(cursor?: string) {
    isLoading.value = true;
    error.value = "";
    try {
      const result = await fetcher(cursor, perPage);
      items.value = result.items;
      meta.value = result.meta;
      if (
        meta.value?.has_more &&
        meta.value.next_cursor &&
        cursors.value.length === pageIndex.value + 1
      ) {
        cursors.value.push(meta.value.next_cursor);
      }
    } catch (err) {
      onApiError?.(err);
      error.value = err instanceof ApiError ? err.message : t(loadErrorKey);
    } finally {
      isLoading.value = false;
    }
  }

  function goNext() {
    if (!meta.value?.has_more || cursors.value.length <= pageIndex.value + 1) return;
    pageIndex.value += 1;
    void load(cursors.value[pageIndex.value]);
  }

  function goPrev() {
    if (pageIndex.value <= 0) return;
    pageIndex.value -= 1;
    void load(cursors.value[pageIndex.value]);
  }

  function reload() {
    void load(cursors.value[pageIndex.value]);
  }

  return {
    items,
    meta,
    page,
    start,
    end,
    showPagination,
    paginationTotal,
    isLoading,
    error,
    load,
    goNext,
    goPrev,
    reload,
  };
}
