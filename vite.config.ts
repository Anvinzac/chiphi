import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
}));
