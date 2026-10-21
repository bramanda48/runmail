<script setup lang="ts">
import { Icon } from "@/icons";
import { currentResolved, currentTheme, setTheme, type Theme } from "@/themes";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
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

const itemClass =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="t('common.theme.label')"
      class="flex h-8 items-center justify-center rounded-md px-2 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon :icon="triggerIcon" class="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="relative z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
      >
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {{ t("common.theme.label") }}
        </div>
        <DropdownMenuSeparator class="-mx-1 my-1 h-px bg-border" />
        <DropdownMenuItem
          v-for="option in options"
          :key="option.value"
          :class="itemClass"
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
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
