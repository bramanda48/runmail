import { ApiError, authorizeCloudflareOAuth, getCloudflareOAuthStatus } from "@/lib/api";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

export function useCloudflareOAuth() {
  const route = useRoute();
  const router = useRouter();
  const configured = ref<boolean | null>(null);
  const checking = ref(false);
  const statusError = ref("");
  const reconnect = ref(false);
  const connecting = ref(false);
  const redirecting = ref(false);
  const notice = ref<{ variant: "success" | "error"; message: string } | null>(null);
  let revision = 0;
  let disposed = false;

  async function checkStatus() {
    const current = ++revision;
    checking.value = true;
    statusError.value = "";
    try {
      const result = await getCloudflareOAuthStatus();
      if (disposed || current !== revision) return;
      configured.value = result.configured;
      if (result.configured) reconnect.value = false;
    } catch {
      if (disposed || current !== revision) return;
      statusError.value = "Status Cloudflare belum dapat diperiksa. Coba periksa lagi.";
    } finally {
      if (!disposed && current === revision) checking.value = false;
    }
  }

  function handleOperationError(error: unknown) {
    if (!(error instanceof ApiError) || error.code !== "OAUTH_NOT_CONFIGURED") return false;
    // A domain error is newer evidence than an in-flight status request.
    revision += 1;
    checking.value = false;
    statusError.value = "";
    configured.value = false;
    reconnect.value = true;
    return true;
  }

  async function connect() {
    if (connecting.value || redirecting.value || configured.value !== false) return;
    connecting.value = true;
    notice.value = null;
    try {
      const origin = window.location.origin;
      const redirect_uri = `${origin}/admin/domains/integration`;
      const { authorization_url } = await authorizeCloudflareOAuth(redirect_uri);
      if (disposed) return;
      const url = new URL(authorization_url);
      if (url.protocol !== "https:") throw new Error("Invalid authorization URL");
      redirecting.value = true;
      window.location.assign(url.href);
    } catch {
      redirecting.value = false;
      notice.value = {
        variant: "error",
        message: "Tidak dapat membuka koneksi Cloudflare. Coba hubungkan lagi.",
      };
    } finally {
      connecting.value = false;
    }
  }

  function onPageShow(event: PageTransitionEvent) {
    if (!event.persisted) return;
    redirecting.value = false;
    connecting.value = false;
    void checkStatus();
  }

  onMounted(() => {
    window.addEventListener("pageshow", onPageShow);
    const oauth = route.query.oauth;
    if (oauth === "success") {
      notice.value = { variant: "success", message: "Cloudflare berhasil terhubung" };
    } else if (oauth === "error" || oauth === "failed" || route.query.error) {
      notice.value = {
        variant: "error",
        message: "Koneksi Cloudflare tidak selesai. Periksa status koneksi, lalu coba lagi.",
      };
    }
    if (oauth || route.query.error) {
      const query = { ...route.query };
      for (const key of ["oauth", "error", "error_description"]) delete query[key];
      void router.replace({ query, hash: route.hash });
    }
    void checkStatus();
  });

  onBeforeUnmount(() => {
    disposed = true;
    revision += 1;
    window.removeEventListener("pageshow", onPageShow);
  });

  return {
    configured,
    checking,
    statusError,
    reconnect,
    connecting,
    redirecting,
    notice,
    canUseCloudflare: computed(
      () => configured.value === true && !connecting.value && !redirecting.value,
    ),
    checkStatus,
    connect,
    handleOperationError,
  };
}
