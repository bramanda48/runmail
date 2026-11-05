import { ApiError, addDomain } from "@/lib/api";
import { cloudflareClient } from "@/lib/cloudflare-client";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

export interface ZoneOption {
  value: string;
  label: string;
}

const ZONE_PAGE_SIZE = 50;
const MAX_ZONES = 500;
export function useAvailableZones(
  registeredIds: () => Set<string>,
  onAuthReset?: (err: unknown) => boolean,
) {
  const { t } = useI18n();
  const isOpen = ref(false);
  const selected = ref("");
  const options = ref<ZoneOption[]>([]);
  const isLoadingZones = ref(false);
  const error = ref("");
  const isSubmitting = ref(false);

  async function open() {
    isOpen.value = true;
    selected.value = "";
    error.value = "";
    options.value = [];
    isLoadingZones.value = true;
    try {
      const taken = registeredIds();
      const zones: ZoneOption[] = [];
      for await (const zone of cloudflareClient.zones.list({ per_page: ZONE_PAGE_SIZE })) {
        if (!taken.has(zone.id)) zones.push({ value: zone.id, label: zone.name });
        if (zones.length >= MAX_ZONES) break;
      }
      options.value = zones;
    } catch (err) {
      if (onAuthReset?.(err)) {
        isOpen.value = false;
        return;
      }
      error.value = err instanceof ApiError ? err.message : t("admin.domains.addError");
    } finally {
      isLoadingZones.value = false;
    }
  }

  async function submit(onAdded: () => void): Promise<boolean> {
    if (isSubmitting.value) return false;
    error.value = "";
    if (!selected.value) {
      error.value = t("admin.domains.validation.domainRequired");
      return false;
    }
    isSubmitting.value = true;
    try {
      await addDomain(selected.value);
      isOpen.value = false;
      onAdded();
      return true;
    } catch (err) {
      if (onAuthReset?.(err)) {
        isOpen.value = false;
        return false;
      }
      error.value = err instanceof ApiError ? err.message : t("admin.domains.addError");
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { isOpen, selected, options, isLoadingZones, error, isSubmitting, open, submit };
}
