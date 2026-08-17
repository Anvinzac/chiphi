import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const adminDeviceBootstrap = mode === "development" ? env.MISE_ADMIN_DEVICE ?? "" : "";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "development" ? "development" : "production"),
      __MISE_ADMIN_DEVICE_BOOTSTRAP__: JSON.stringify(adminDeviceBootstrap),
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
