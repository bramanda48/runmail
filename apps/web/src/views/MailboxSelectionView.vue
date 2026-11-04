<script setup lang="ts">
import EmptyState from "@/components/forms/EmptyState.vue";
import Pagination from "@/components/forms/Pagination.vue";
import MemberShell from "@/components/layouts/MemberShell.vue";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCursorPagination } from "@/composables/use-cursor-pagination";
import { Icon } from "@/icons";
import { listMailboxes } from "@/lib/api";
import { groupMailboxesByTeam } from "@/lib/mailbox-groups";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import type { Mailbox } from "@runmail/shared";
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, useRouter } from "vue-router";

const { t } = useI18n();
const authStore = useAuthStore();
const router = useRouter();

const perPage = 10;

const {
  items: mailboxes,
  page,
  start,
  end,
  showPagination,
  paginationTotal,
  isLoading,
  error,
  load,
  goNext,
  goPrev,
  reload,
} = useCursorPagination<Mailbox>(
  async (cursor, limit) => {
    const { data, meta: responseMeta } = await listMailboxes(cursor, limit);
    return { items: data.mailboxes, meta: responseMeta ?? null };
  },
  "mailbox.errors.load",
  perPage,
);

const groups = computed(() => groupMailboxesByTeam(mailboxes.value));

/** Mailboxes with no team path - rendered in the direct section. */
const directMailboxes = computed(() => groups.value.directMailboxes);

/**
 * One section per team granting access on this page.
 * A mailbox shared via two teams appears under both sections.
 */
const teamSections = computed(() => groups.value.teamSections);

function retry() {
  reload();
}

function selectMailbox(mailbox: Mailbox) {
  if (!mailbox.is_active) return;
  router.push(`/mailboxes/${mailbox.id}/inbox`);
}

onMounted(() => load());

function rowClasses(isActive: boolean) {
  return cn(
    "flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    isActive ? "hover:bg-accent cursor-pointer" : "cursor-not-allowed opacity-60",
  );
}
</script>

<template>
  <MemberShell>
    <main class="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="scroll-m-20 text-3xl font-extrabold tracking-tight text-foreground">
          {{ t("mailbox.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">{{ t("mailbox.subtitle") }}</p>
      </div>

      <div v-if="isLoading" class="flex flex-col gap-4">
        <Skeleton v-for="n in 4" :key="n" class="h-18 w-full" />
      </div>

      <div v-else-if="error" class="flex flex-col gap-4">
        <Alert variant="destructive">{{ error }}</Alert>
        <Button variant="outline" @click="retry">{{ t("common.actions.retry") }}</Button>
      </div>

      <EmptyState
        v-else-if="mailboxes.length === 0"
        icon="lucide:inbox"
        :heading="t('mailbox.empty.title')"
        :description="t('mailbox.empty.description')"
      >
        <template v-if="authStore.isAdmin" #action>
          <div class="flex flex-col items-center gap-2">
            <p class="text-sm text-muted-foreground">{{ t("mailbox.empty.adminHint") }}</p>
            <RouterLink
              :to="{ name: 'admin-mailboxes' }"
              class="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {{ t("mailbox.empty.adminLink") }}
            </RouterLink>
          </div>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-6">
        <section
          v-if="directMailboxes.length > 0"
          class="flex flex-col gap-3"
          aria-label="Direct access"
        >
          <h2 class="text-sm font-semibold text-muted-foreground">
            {{ t("mailbox.direct.title") }}
          </h2>
          <button
            v-for="mailbox in directMailboxes"
            :key="mailbox.id"
            type="button"
            :disabled="!mailbox.is_active"
            :aria-disabled="mailbox.is_active ? undefined : 'true'"
            :class="rowClasses(mailbox.is_active)"
            @click="selectMailbox(mailbox)"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Icon icon="lucide:mail" class="size-5" />
            </div>

            <div class="min-w-0 flex-1">
              <p :class="cn('truncate font-medium', !mailbox.is_active && 'text-muted-foreground')">
                {{ mailbox.address }}
              </p>
              <p v-if="!mailbox.is_active" class="text-xs text-muted-foreground">
                {{ t("mailbox.inactive") }}
              </p>
            </div>

            <Badge :variant="mailbox.is_active ? 'secondary' : 'outline'">
              {{ mailbox.is_active ? t("mailbox.status.active") : t("mailbox.status.inactive") }}
            </Badge>
          </button>
        </section>

        <section
          v-for="section in teamSections"
          :key="section.team_id"
          class="flex flex-col gap-3"
          :aria-label="t('mailbox.team.title', { name: section.name })"
        >
          <h2 class="text-sm font-semibold text-muted-foreground">
            {{ t("mailbox.team.title", { name: section.name }) }}
          </h2>
          <button
            v-for="mailbox in section.mailboxes"
            :key="mailbox.id"
            type="button"
            :disabled="!mailbox.is_active"
            :aria-disabled="mailbox.is_active ? undefined : 'true'"
            :class="rowClasses(mailbox.is_active)"
            @click="selectMailbox(mailbox)"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Icon icon="lucide:mail" class="size-5" />
            </div>

            <div class="min-w-0 flex-1">
              <p :class="cn('truncate font-medium', !mailbox.is_active && 'text-muted-foreground')">
                {{ mailbox.address }}
              </p>
              <p v-if="!mailbox.is_active" class="text-xs text-muted-foreground">
                {{ t("mailbox.inactive") }}
              </p>
            </div>

            <Badge :variant="mailbox.is_active ? 'secondary' : 'outline'">
              {{ mailbox.is_active ? t("mailbox.status.active") : t("mailbox.status.inactive") }}
            </Badge>
          </button>
        </section>

        <Pagination
          v-if="showPagination"
          :page="page"
          :per-page="perPage"
          :total="paginationTotal"
          :disabled="isLoading"
          @prev="goPrev"
          @next="goNext"
        >
          <template #range>{{ start }}–{{ end }}</template>
        </Pagination>
      </div>
    </main>
  </MemberShell>
</template>
