import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

export function useSearchQuerySync() {
  const route = useRoute();
  const router = useRouter();

  const searchQuery = ref("");
  const debouncedSearch = ref("");

  function queryParamValue(): string {
    const q = route.query.q;
    return typeof q === "string" ? q : "";
  }

  function applyQueryParam(): void {
    const value = queryParamValue();
    searchQuery.value = value;
    debouncedSearch.value = value;
  }

  function onSearch(value: string): void {
    debouncedSearch.value = value;
    const current = queryParamValue();
    if ((value || "") === current) return;
    void router.replace({ query: value ? { q: value } : {} });
  }

  watch(
    () => route.query.q,
    () => {
      if (queryParamValue() !== debouncedSearch.value) applyQueryParam();
    },
  );

  return {
    searchQuery,
    debouncedSearch,
    queryParamValue,
    applyQueryParam,
    onSearch,
  };
}
