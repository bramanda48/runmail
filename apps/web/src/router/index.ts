import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useMailboxAccessStore } from "@/stores/mailboxAccess";

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
    component: () => import("@/views/LoginView.vue")
  },
  {
    path: "/mailboxes",
    name: "mailbox-selection",
    component: () => import("@/views/MailboxSelectionView.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/mailboxes/:mailbox_id/inbox",
    name: "inbox",
    component: () => import("@/views/MailboxInboxView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true }
  },
  {
    path: "/mailboxes/:mailbox_id/folders/:folder_id",
    name: "folder",
    component: () => import("@/views/MailboxInboxView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true }
  },
  {
    path: "/mailboxes/:mailbox_id/messages/:message_id",
    name: "message-detail",
    component: () => import("@/views/MessageDetailView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true }
  },
  {
    path: "/mailboxes/:mailbox_id/folders",
    name: "folders",
    component: () => import("@/views/FolderManagementView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true }
  },
  {
    path: "/mailboxes/:mailbox_id/rulesets",
    name: "rulesets",
    component: () => import("@/views/RulesetListView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true }
  },
  {
    path: "/mailboxes/:mailbox_id/rulesets/:ruleset_id",
    name: "ruleset-editor",
    component: () => import("@/views/RulesetEditorView.vue"),
    meta: { requiresAuth: true, mailboxScoped: true }
  },
  {
    path: "/account",
    name: "account",
    component: () => import("@/views/AccountView.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/admin/users",
    name: "admin-users",
    component: () => import("@/views/AdminUsersView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/domains/integration",
    name: "admin-domains-integration",
    component: () => import("@/views/AdminDomainsIntegrationView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/domains",
    name: "admin-domains",
    component: () => import("@/views/AdminDomainsView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/mailboxes",
    name: "admin-mailboxes",
    component: () => import("@/views/AdminMailboxesView.vue"),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  { path: "/:pathMatch(.*)*", name: "not-found", redirect: "/mailboxes" }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    const restored = await auth.restoreSession();
    if (!restored) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }
  }

  if (to.name === "login" && auth.isAuthenticated) {
    return { path: "/mailboxes" };
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { path: "/mailboxes" };
  }

  if (to.meta.mailboxScoped && typeof to.params.mailbox_id === "string") {
    const access = useMailboxAccessStore();
    const verdict = await access.ensureAccessible(to.params.mailbox_id);
    if (verdict === "forbidden" || verdict === "not_found" || verdict === "inactive") {
      return { path: "/mailboxes" };
    }
  }

  return true;
});

export default router;
