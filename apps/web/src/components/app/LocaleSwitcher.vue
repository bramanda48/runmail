<script setup lang="ts">
import type { Locale } from "@/i18n";
import { SUPPORTED_LOCALES, setLocale } from "@/i18n";
import { Icon } from "@/icons";
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

const { t, locale } = useI18n();

const current = computed(() => locale.value.toUpperCase());
const options = computed(() =>
  SUPPORTED_LOCALES.map((value) => ({ value, label: t(`common.language.${value}`) })),
);

const itemClass =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

function select(next: Locale) {
  setLocale(next);
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="t('common.language.label')"
      class="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold uppercase text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon icon="lucide:languages" class="size-4" />
      {{ current }}
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="relative z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
      >
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {{ t("common.language.label") }}
        </div>
        <DropdownMenuSeparator class="-mx-1 my-1 h-px bg-border" />
        <DropdownMenuItem
          v-for="option in options"
          :key="option.value"
          :class="itemClass"
          @select="select(option.value)"
        >
          <Icon
            v-if="option.value === locale"
            icon="lucide:check"
            class="size-4 text-muted-foreground"
          />
          <span v-else class="size-4" aria-hidden="true" />
          {{ option.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
