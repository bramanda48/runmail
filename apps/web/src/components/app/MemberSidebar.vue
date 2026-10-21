<script setup lang="ts">
import NavItem from "@/components/app/NavItem.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

const route = useRoute();
const { t } = useI18n();

const profileNav = computed(() => [
  { label: t("shell.memberSidebar.mailboxes"), to: "/mailboxes", icon: "lucide:layout-grid" },
  { label: t("shell.memberSidebar.profile"), to: "/profile", icon: "lucide:circle-user-round" },
]);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-4">
    <nav class="min-h-0 flex-1 overflow-y-auto" :aria-label="t('shell.memberSidebar.navLabel')">
      <div class="flex flex-col gap-1">
        <NavItem
          v-for="item in profileNav"
          :key="item.to"
          :label="item.label"
          :icon="item.icon"
          :to="item.to"
          :active="route.path === item.to"
          active-class="bg-accent text-accent-foreground font-semibold"
        />
      </div>
    </nav>
  </div>
</template>
