<script setup lang="ts">
import EmptyState from "@/components/app/EmptyState.vue";
import Pagination from "@/components/app/Pagination.vue";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icon } from "@/icons";
import { translateApiError } from "@/i18n/api-errors";
import { ApiError, deleteRuleset, getRuleset, listRulesets, updateRuleset } from "@/lib/api";
import type { ApiMeta, LogicOperator, RulesetDetail } from "@runmail/shared";
import { computed, onMounted, ref, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const props = defineProps<{ mailboxId: string }>();
const mailboxId = toRef(props, "mailboxId");
const router = useRouter();
const { t } = useI18n();

const perPage = 10;

const rulesets = ref<RulesetDetail[]>([]);
const meta = ref<ApiMeta | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const isLoading = ref(false);
const error = ref("");

const toggleLoadingId = ref<string | null>(null);
const deleteOpen = ref(false);
const rulesetToDelete = ref<RulesetDetail | null>(null);
const deleteSubmitting = ref(false);

const page = computed(() => pageIndex.value + 1);
const start = computed(() => pageIndex.value * perPage + 1);
const end = computed(() => start.value + rulesets.value.length - 1);
const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);
const paginationTotal = computed(() =>
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage,
);

const logicLabels = computed<Record<LogicOperator, string>>(() => ({
  AND: t("rulesets.logic.AND"),
  OR: t("rulesets.logic.OR"),
}));

async function load(cursor?: string) {
  isLoading.value = true;
  error.value = "";
  try {
    const { data, meta: responseMeta } = (await listRulesets(
      mailboxId.value,
      cursor,
      perPage,
    )) as unknown as {
      data: { rulesets: RulesetDetail[] };
      meta?: ApiMeta;
    };
    rulesets.value = data.rulesets;
    meta.value = responseMeta ?? null;
    if (
      meta.value?.has_more &&
      meta.value.next_cursor &&
      cursors.value.length === pageIndex.value + 1
    ) {
      cursors.value.push(meta.value.next_cursor);
    }
  } catch (err) {
    error.value = err instanceof ApiError ? translateApiError(err) : t("rulesets.errors.load");
  } finally {
    isLoading.value = false;
  }
}

function goNext() {
  if (!meta.value?.has_more || cursors.value.length <= pageIndex.value + 1) return;
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

function createRuleset() {
  router.push(`/mailboxes/${mailboxId.value}/settings/rulesets/new`);
}

function editRuleset(ruleset: RulesetDetail) {
  router.push(`/mailboxes/${mailboxId.value}/settings/rulesets/${ruleset.id}`);
}

function openDelete(ruleset: RulesetDetail) {
  rulesetToDelete.value = ruleset;
  deleteOpen.value = true;
}

async function confirmDelete() {
  if (!rulesetToDelete.value) return;
  deleteSubmitting.value = true;
  try {
    await deleteRuleset(mailboxId.value, rulesetToDelete.value.id);
    deleteOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    error.value = err instanceof ApiError ? translateApiError(err) : t("rulesets.errors.delete");
  } finally {
    deleteSubmitting.value = false;
  }
}

async function toggleEnabled(ruleset: RulesetDetail, value: boolean) {
  if (toggleLoadingId.value) return;
  toggleLoadingId.value = ruleset.id;

  // Optimistic update
  const original = ruleset.is_enabled;
  ruleset.is_enabled = value;

  try {
    const { ruleset: detail } = await getRuleset(mailboxId.value, ruleset.id);
    await updateRuleset(mailboxId.value, ruleset.id, {
      name: detail.name,
      priority: detail.priority,
      logic_operator: detail.logic_operator,
      is_enabled: value,
      conditions: detail.conditions.map((c) => ({
        field: c.field,
        match_type: c.match_type,
        condition_value: c.condition_value,
      })),
      actions: detail.actions.map((a) => ({
        action_type: a.action_type,
        action_value: a.action_value,
      })),
    });
  } catch (err) {
    // Rollback
    ruleset.is_enabled = original;
    error.value = err instanceof ApiError ? translateApiError(err) : t("rulesets.errors.toggle");
  } finally {
    toggleLoadingId.value = null;
  }
}

onMounted(() => load(undefined));
watch(mailboxId, () => {
  pageIndex.value = 0;
  cursors.value = [undefined];
  load(undefined);
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-foreground">{{ t("rulesets.title") }}</h2>
        <p class="text-sm text-muted-foreground">{{ t("rulesets.description") }}</p>
      </div>
      <Button @click="createRuleset">
        <Icon icon="lucide:plus" />
        <span>{{ t("rulesets.actions.create") }}</span>
      </Button>
    </div>

    <div v-if="isLoading" class="flex flex-col gap-4">
      <Skeleton class="h-12 w-full" />
      <Skeleton class="h-12 w-full" />
      <Skeleton class="h-12 w-full" />
      <Skeleton class="h-12 w-full" />
    </div>

    <div v-else-if="error" class="flex flex-col gap-4">
      <Alert variant="destructive">{{ error }}</Alert>
      <Button variant="ghost" @click="retry">{{ t("common.actions.retry") }}</Button>
    </div>

    <EmptyState
      v-else-if="rulesets.length === 0"
      icon="lucide:filter"
      :heading="t('rulesets.empty.heading')"
      :description="t('rulesets.empty.description')"
    >
      <template #action>
        <Button class="mt-4" @click="createRuleset">
          <Icon icon="lucide:plus" />
          <span>{{ t("rulesets.actions.create") }}</span>
        </Button>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-4">
      <div class="rounded-lg border bg-card p-4">
        <div class="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("rulesets.list.name") }}</TableHead>
                <TableHead class="w-24">{{ t("rulesets.list.priority") }}</TableHead>
                <TableHead class="w-24">{{ t("rulesets.list.logic") }}</TableHead>
                <TableHead class="w-24">{{ t("rulesets.list.active") }}</TableHead>
                <TableHead class="w-24">{{ t("rulesets.list.actions") }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="ruleset in rulesets" :key="ruleset.id">
                <TableCell class="font-medium">
                  <div class="flex flex-col">
                    <span class="truncate">{{ ruleset.name }}</span>
                    <span class="text-xs text-muted-foreground">
                      {{ t("rulesets.list.conditionCount", ruleset.conditions.length) }},
                      {{ t("rulesets.list.actionCount", ruleset.actions.length) }}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ ruleset.priority }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ logicLabels[ruleset.logic_operator] }}</Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    :model-value="ruleset.is_enabled"
                    :ariaLabel="t('rulesets.list.toggleAria', { name: ruleset.name })"
                    :disabled="toggleLoadingId === ruleset.id"
                    @update:model-value="toggleEnabled(ruleset, $event)"
                  />
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-1">
                    <Button
                      :aria-label="t('rulesets.list.editAria', { name: ruleset.name })"
                      variant="ghost"
                      size="icon"
                      @click="editRuleset(ruleset)"
                    >
                      <Icon icon="lucide:pencil" />
                    </Button>
                    <Button
                      :aria-label="t('rulesets.list.deleteAria', { name: ruleset.name })"
                      variant="ghost"
                      size="icon"
                      @click="openDelete(ruleset)"
                    >
                      <Icon icon="lucide:trash" class="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

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

    <!-- Delete confirmation -->
    <DialogRoot v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("rulesets.deleteDialog.title") }}</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-foreground">
          {{ t("rulesets.deleteDialog.confirmPrefix") }}
          <strong>{{ rulesetToDelete?.name }}</strong
          >{{ t("rulesets.deleteDialog.confirmSuffix") }}
        </p>
        <DialogFooter>
          <Button variant="ghost" :disabled="deleteSubmitting" @click="deleteOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button variant="destructive" :disabled="deleteSubmitting" @click="confirmDelete">
            <Icon v-if="deleteSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("common.actions.delete") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </div>
</template>
