import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = env.PORT ? Number(env.PORT) : 3000;
  const worker = env.WORKER_URL ? env.WORKER_URL : "runmail.localhost";

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
    server: {
      port,
      proxy: {
        // Windows cannot resolve *.localhost via system DNS, and hosts-file sync
        // is not portable there. Target 127.0.0.1:443 directly; portless proxy
        // routes by SNI/Host header, so set changeOrigin + servername.
        // `secure: false` because portless uses a self-signed local CA.
        "/api/v1": {
          target: "https://127.0.0.1:443",
          secure: false,
          changeOrigin: true,
          headers: {
            Host: worker,
          },
        },
      },
    },
  };
});
