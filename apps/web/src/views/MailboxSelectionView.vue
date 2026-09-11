<script setup lang="ts">
import type { ApiMeta, Mailbox } from "@runmail/shared";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import EmptyState from "@/components/app/empty-state.vue";
import Wordmark from "@/components/app/wordmark.vue";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/icons";
import { ApiError, listMailboxes } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();

const perPage = 10;

const mailboxes = ref<Mailbox[]>([]);
const meta = ref<ApiMeta | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const isLoading = ref(false);
const error = ref("");

const page = computed(() => pageIndex.value + 1);
const start = computed(() => pageIndex.value * perPage + 1);
const end = computed(() => start.value + mailboxes.value.length - 1);

const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);

const paginationTotal = computed(() =>
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage
);

async function load(cursor?: string) {
  isLoading.value = true;
  error.value = "";

  try {
    const { data, meta: responseMeta } = await listMailboxes(cursor, perPage);
    mailboxes.value = data.mailboxes;
    meta.value = responseMeta ?? null;

    if (
      meta.value?.has_more &&
      meta.value.next_cursor &&
      cursors.value.length === pageIndex.value + 1
    ) {
      cursors.value.push(meta.value.next_cursor);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
    } else {
      error.value = "Tidak dapat memuat mailbox. Coba lagi.";
    }
  } finally {
    isLoading.value = false;
  }
}

function goNext() {
  if (!meta.value?.has_more || cursors.value.length <= pageIndex.value + 1) {
    return;
  }
  pageIndex.value += 1;
  load(cursors.value[pageIndex.value]);
}

function goPrev() {
  if (pageIndex.value <= 0) return;
  pageIndex.value -= 1;
  load(cursors.value[pageIndex.value]);
}

function retry() {
  load(cursors.value[pageIndex.value]);
}

function selectMailbox(mailbox: Mailbox) {
  if (!mailbox.is_active) return;
  router.push(`/mailboxes/${mailbox.id}/inbox`);
}

async function logout() {
  if (window.confirm("Apakah Anda yakin ingin keluar?")) {
    await auth.logout();
    await router.push("/login");
  }
}

onMounted(() => load(undefined));

function rowClasses(isActive: boolean) {
  return cn(
    "flex w-full items-center gap-4 rounded-2xl border bg-surface p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    isActive ? "hover:bg-accent cursor-pointer" : "cursor-not-allowed opacity-60"
  );
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <header
      class="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-surface px-4 lg:px-8"
    >
      <Wordmark size="sm" />
      <div class="flex items-center gap-3">
        <span class="hidden text-sm text-foreground sm:inline">
          {{ auth.user?.username }}
        </span>
        <Button variant="ghost" size="sm" @click="logout">
          <Icon icon="lucide:log-out" />
          <span>Keluar</span>
        </Button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-2xl flex-1 p-4 lg:p-8">
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-foreground">Pilih Mailbox</h1>
        <p class="text-sm text-muted-foreground">Pilih mailbox yang ingin Anda akses.</p>
      </div>

      <div v-if="isLoading" class="space-y-4">
        <Skeleton shape="list" :rows="4" />
      </div>

      <div v-else-if="error" class="space-y-4">
        <Alert variant="error">{{ error }}</Alert>
        <Button variant="ghost" @click="retry">Coba Lagi</Button>
      </div>

      <EmptyState
        v-else-if="mailboxes.length === 0"
        icon="lucide:inbox"
        heading="Belum ada mailbox"
        description="Anda belum terhubung ke mailbox mana pun."
      >
        <template v-if="auth.isAdmin" #action>
          <p class="mt-2 text-sm text-muted-foreground">
            Admin dapat membuat mailbox pada menu Mailbox Management.
          </p>
        </template>
      </EmptyState>

      <div v-else class="space-y-3">
        <button
          v-for="mailbox in mailboxes"
          :key="mailbox.id"
          type="button"
          :disabled="!mailbox.is_active"
          :aria-disabled="mailbox.is_active ? undefined : 'true'"
          :class="rowClasses(mailbox.is_active)"
          @click="selectMailbox(mailbox)"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-foreground"
          >
            <Icon icon="lucide:mail" class="size-5" />
          </div>

          <div class="min-w-0 flex-1">
            <p
              :class="
                cn(
                  'truncate font-medium',
                  !mailbox.is_active && 'text-muted-foreground',
                )
              "
            >
              {{ mailbox.address }}
            </p>
            <p v-if="!mailbox.is_active" class="text-xs text-muted-foreground">
              Mailbox nonaktif
            </p>
          </div>

          <Badge :variant="mailbox.is_active ? 'success' : 'inactive'">
            {{ mailbox.is_active ? "Aktif" : "Nonaktif" }}
          </Badge>
        </button>

        <Pagination
          v-if="showPagination"
          :page="page"
          :per-page="perPage"
          :total="paginationTotal"
          :disabled="isLoading"
          @prev="goPrev"
          @next="goNext"
        >
          <template #range> {{ start }}–{{ end }} </template>
        </Pagination>
      </div>
    </main>
  </div>
</template>
