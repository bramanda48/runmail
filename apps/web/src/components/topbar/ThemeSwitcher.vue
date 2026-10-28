<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/icons";
import { useThemeStore, type Theme } from "@/stores/theme";
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../ui/button";

const themeStore = useThemeStore();
const { theme: currentTheme, resolved: currentResolved } = storeToRefs(themeStore);

const { t } = useI18n();

const triggerIcon = computed(() =>
  currentResolved.value === "dark" ? "lucide:moon" : "lucide:sun",
);

const options = computed(() => [
  { value: "light" as const, icon: "lucide:sun", label: t("common.theme.light") },
  { value: "dark" as const, icon: "lucide:moon", label: t("common.theme.dark") },
  { value: "system" as const, icon: "lucide:monitor", label: t("common.theme.system") },
]);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button
        :aria-label="t('common.theme.label')"
        variant="link"
        class="text-muted-foreground hover:text-accent-foreground"
      >
        <Icon :icon="triggerIcon" class="size-5!" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :side-offset="8" class="min-w-48">
      <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
        {{ t("common.theme.label") }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="option in options"
        :key="option.value"
        @select="themeStore.setTheme(option.value as Theme)"
      >
        <Icon
          v-if="option.value === currentTheme"
          icon="lucide:check"
          class="size-4 text-muted-foreground"
        />
        <span v-else class="size-4" aria-hidden="true" />
        <Icon :icon="option.icon" class="size-4" />
        {{ option.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
