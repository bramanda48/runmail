<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import AppShell from "@/components/app/app-shell.vue";
import NavItem from "@/components/app/nav-item.vue";
import Wordmark from "@/components/app/wordmark.vue";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/icons";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const adminNav = [
  { label: "User", to: "/admin/users", icon: "lucide:users" },
  { label: "Domain", to: "/admin/domains", icon: "lucide:globe" },
  { label: "Mailbox", to: "/admin/mailboxes", icon: "lucide:mail" }
];

async function logout() {
  if (window.confirm("Apakah Anda yakin ingin keluar?")) {
    await auth.logout();
    await router.push("/login");
  }
}
</script>

<template>
  <AppShell>
    <template #navigation>
      <div class="flex h-full flex-col">
        <div class="p-4">
          <Wordmark size="sm" class="mb-6" />
          <nav class="flex flex-col gap-1" aria-label="Navigasi admin">
            <NavItem
              v-for="item in adminNav"
              :key="item.to"
              :label="item.label"
              :icon="item.icon"
              :to="item.to"
              :active="route.path === item.to"
            />
            <div class="my-3 border-t" />
            <NavItem
              label="Kembali ke Mailbox"
              icon="lucide:arrow-left"
              to="/mailboxes"
            />
          </nav>
        </div>
        <div class="mt-auto p-4">
          <IconButton
            :ariaLabel="'Keluar'"
            variant="ghost"
            class="w-full"
            @click="logout"
          >
            <Icon icon="lucide:log-out" />
            <span>Keluar</span>
          </IconButton>
        </div>
      </div>
    </template>

    <template #topbar>
      <div class="flex items-center gap-3">
        <Wordmark size="sm" />
        <Badge variant="success">Admin</Badge>
      </div>
    </template>

    <slot />
  </AppShell>
</template>
