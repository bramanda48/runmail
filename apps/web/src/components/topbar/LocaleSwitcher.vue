<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/i18n";
import { SUPPORTED_LOCALES, setLocale } from "@/i18n";
import { Icon } from "@/icons";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../ui/button";

const { t, locale } = useI18n();

const current = computed(() => locale.value.toUpperCase());
const options = computed(() =>
  SUPPORTED_LOCALES.map((value) => ({ value, label: t(`common.language.${value}`) })),
);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger :aria-label="t('common.language.label')">
      <Button
        :aria-label="t('common.theme.label')"
        variant="link"
        class="text-muted-foreground hover:text-accent-foreground"
      >
        {{ current }}
      </Button>
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
