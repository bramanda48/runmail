<script setup lang="ts">
import Wordmark from "@/components/app/Wordmark.vue";
import { Badge } from "@/components/ui/badge";
</script>

<template>
  <div class="flex items-center gap-3">
    <Wordmark size="sm" />
    <Badge variant="secondary">Admin</Badge>
  </div>
</template>
