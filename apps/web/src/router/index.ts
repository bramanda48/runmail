import { getLastMailboxId } from "@/lib/last-mailbox";
import { useAuthStore } from "@/stores/auth";
import { useMailboxStore } from "@/stores/mailbox";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    mailboxScoped?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/login" },
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/LoginView.vue"),
  },
  {
    path: "/mailboxes",
    name: "mailbox-selection",
    component: () => import("@/views/MailboxSelectionView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/mailboxes/:mailbox_id/inbox",
    name: "inbox",
    component: () => import("@/views/MailboxInboxView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true },
  },
  {
    path: "/mailboxes/:mailbox_id/folders/:folder_id",
    name: "folder",
    component: () => import("@/views/MailboxInboxView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true },
  },
  {
    path: "/mailboxes/:mailbox_id/messages/:message_id",
    name: "message-detail",
    component: () => import("@/views/MessageDetailView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true },
  },
  {
    path: "/mailboxes/:mailbox_id/settings",
    component: () => import("@/views/MailboxSettingsView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true },
    redirect: (to) => ({ name: "settings-folders", params: { mailbox_id: to.params.mailbox_id } }),
    children: [
      {
        path: "folders",
        name: "settings-folders",
        component: () => import("@/components/settings/FolderSettingsTab.vue"),
      },
      {
        path: "rulesets",
        name: "settings-rulesets",
        component: () => import("@/components/settings/RulesetSettingsTab.vue"),
      },
      {
        path: "rulesets/new",
        name: "settings-ruleset-new",
        component: () => import("@/components/settings/RulesetEditorTab.vue"),
      },
      {
        path: "rulesets/:ruleset_id",
        name: "settings-ruleset-edit",
        component: () => import("@/components/settings/RulesetEditorTab.vue"),
      },
    ],
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import("@/views/ProfileView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/admin/users",
    name: "admin-users",
    component: () => import("@/views/AdminUsersView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: "/admin/domains/integration",
    name: "admin-domains-integration",
    component: () => import("@/views/AdminDomainsIntegrationView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: "/admin/domains",
    name: "admin-domains",
    component: () => import("@/views/AdminDomainsView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: "/admin/mailboxes",
    name: "admin-mailboxes",
    component: () => import("@/views/AdminMailboxesView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: "/admin/teams",
    name: "admin-teams",
    component: () => import("@/views/AdminTeamsView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  { path: "/:pathMatch(.*)*", name: "not-found", redirect: "/mailboxes" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const mailboxStore = useMailboxStore();

  if (!authStore.isAuthenticated) {
    const restored = await authStore.restoreSession();
    if (to.meta.requiresAuth && !restored) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }
    if (to.name === "login" && !restored) {
      // No session to restore — stay on the login page.
      return true;
    }
  }

  if (to.name === "login" && authStore.isAuthenticated) {
    const mailboxId = getLastMailboxId();
    if (mailboxId !== null) {
      const verdict = await mailboxStore.ensureAccessible(mailboxId);
      if (verdict === "ok") {
        return { path: `/mailboxes/${mailboxId}/inbox` };
      }
    }
    return { path: "/mailboxes" };
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { path: "/mailboxes" };
  }

  if (to.meta.mailboxScoped && typeof to.params.mailbox_id === "string") {
    const verdict = await mailboxStore.ensureAccessible(to.params.mailbox_id);
    if (verdict === "forbidden" || verdict === "not_found" || verdict === "inactive") {
      return { path: "/mailboxes" };
    }
  }

  return true;
});

export default router;
