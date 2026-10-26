<script setup lang="ts">
import { Icon } from "@/icons";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const actions = computed(() => [
  { icon: "lucide:calendar-check", label: t("shell.accessoryRail.calendar") },
  { icon: "lucide:lightbulb", label: t("shell.accessoryRail.keep") },
  { icon: "lucide:check-circle-2", label: t("shell.accessoryRail.tasks") },
  { icon: "lucide:circle-user-round", label: t("shell.accessoryRail.contacts") },
]);
</script>

<template>
  <aside
    :aria-label="t('shell.accessoryRail.label')"
    class="flex w-[56px] flex-col items-center gap-6 py-4"
  >
    <button
      v-for="action in actions"
      :key="action.icon"
      type="button"
      disabled
      :title="t('shell.accessoryRail.comingSoon')"
      :aria-label="action.label"
      class="flex size-10 items-center justify-center rounded-full text-muted-foreground"
    >
      <Icon :icon="action.icon" class="size-5" />
    </button>
    <div aria-hidden="true" class="w-6 border-b border-border" />
    <button
      type="button"
      disabled
      :title="t('shell.accessoryRail.comingSoon')"
      :aria-label="t('shell.accessoryRail.addApp')"
      class="flex size-10 items-center justify-center rounded-full text-muted-foreground"
    >
      <Icon icon="lucide:plus" class="size-5" />
    </button>
  </aside>
</template>
