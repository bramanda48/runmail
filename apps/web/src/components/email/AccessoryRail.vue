<script setup lang="ts">
import { Icon } from "@/icons";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../ui/button";

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
    class="flex w-14 flex-col items-center gap-6 py-4"
  >
    <Button
      v-for="action in actions"
      :key="action.icon"
      :title="t('shell.accessoryRail.comingSoon')"
      :aria-label="action.label"
      variant="link"
      class="text-muted-foreground"
      disabled
    >
      <Icon :icon="action.icon" class="size-5!" />
    </Button>
    <div aria-hidden="true" class="w-6 border-b border-border" />
    <Button
      :title="t('shell.accessoryRail.comingSoon')"
      :aria-label="t('shell.accessoryRail.addApp')"
      variant="link"
      class="flex size-10 items-center justify-center rounded-full text-muted-foreground"
      disabled
    >
      <Icon icon="lucide:plus" class="size-5!" />
    </Button>
  </aside>
</template>
