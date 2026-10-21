<script setup lang="ts">
import type { Locale } from "@/i18n";
import { SUPPORTED_LOCALES, setLocale } from "@/i18n";
import { Icon } from "@/icons";
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

const { t, locale } = useI18n();

const current = computed(() => locale.value.toUpperCase());
const options = computed(() =>
  SUPPORTED_LOCALES.map((value) => ({ value, label: t(`common.language.${value}`) })),
);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :aria-label="t('common.language.label')"
      class="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold uppercase text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon icon="lucide:languages" class="size-4" />
      {{ current }}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :side-offset="8" class="min-w-48">
      <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
        {{ t("common.language.label") }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="option in options"
        :key="option.value"
        @select="setLocale(option.value as Locale)"
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
  </DropdownMenu>
</template>
