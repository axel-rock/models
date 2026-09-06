import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "guide-directory-index",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (/^\/guides\/(?:[a-z0-9-]+\/)?$/.test(url.pathname)) {
            request.url = `${url.pathname}index.html${url.search}`;
          }
          next();
        });
      },
    },
  ],
  base: process.env.VITE_BASE_PATH ?? "/",
  optimizeDeps: { entries: ["index.html"] },
  build: {
    target: "es2022",
  },
});
