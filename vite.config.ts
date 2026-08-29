import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const MISSING_OPENAI_KEY =
  "Chưa có OPENAI_API_KEY trong .env.local. Thêm OPENAI_API_KEY (và tuỳ chọn OPENAI_BASE_URL, OPENAI_MODEL) rồi restart bun run dev.";

function openaiCompatProxy(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "");
  const openaiKey = (env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "").trim();
  return {
    name: "openai-compat-placeholder",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/openai-compat")) return next();
        if (openaiKey) return next();
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: { message: MISSING_OPENAI_KEY } }));
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openaiKey = (env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "").trim();
  const openaiBase = (env.OPENAI_BASE_URL || env.VITE_OPENAI_BASE_URL || "https://api.openai.com/v1")
    .trim()
    .replace(/\/$/, "");
  const openaiModel = (env.OPENAI_MODEL || env.VITE_OPENAI_MODEL || "gpt-4o").trim() || "gpt-4o";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/openai-compat": {
          target: openaiBase,
          changeOrigin: true,
          rewrite: prefix => prefix.replace(/^\/openai-compat/, ""),
          configure(proxy) {
            proxy.on("proxyReq", proxyReq => {
              if (openaiKey) proxyReq.setHeader("Authorization", `Bearer ${openaiKey}`);
            });
          },
        },
      },
    },
    plugins: [react(), openaiCompatProxy(mode)],
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "development" ? "development" : "production"),
      "import.meta.env.VITE_OPENAI_MODEL": JSON.stringify(openaiModel),
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          "process.env.NODE_ENV": JSON.stringify("development"),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
