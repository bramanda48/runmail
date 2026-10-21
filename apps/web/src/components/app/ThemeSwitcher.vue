<script setup lang="ts">
import { Icon } from "@/icons";
import { currentResolved, currentTheme, setTheme, type Theme } from "@/themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const triggerIcon = computed(() =>
  currentResolved.value === "dark" ? "lucide:moon" : "lucide:sun",
);

const options = computed(() =>
  [
    { value: "light" as const, icon: "lucide:sun", label: t("common.theme.light") },
    { value: "dark" as const, icon: "lucide:moon", label: t("common.theme.dark") },
    { value: "system" as const, icon: "lucide:monitor", label: t("common.theme.system") },
  ],
);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :aria-label="t('common.theme.label')"
      class="flex h-8 items-center justify-center rounded-md px-2 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon :icon="triggerIcon" class="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :side-offset="8" class="min-w-48">
      <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
        {{ t("common.theme.label") }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="option in options"
        :key="option.value"
        @select="setTheme(option.value as Theme)"
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
