<script setup lang="ts">
import Wordmark from "@/components/app/Wordmark.vue";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center gap-3">
    <Wordmark size="sm" />
    <Badge variant="secondary">{{ t("shell.adminBadge") }}</Badge>
  </div>
</template>
