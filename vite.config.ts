// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    // The default TanStack dev client wraps the app in React StrictMode, which
    // intentionally unmounts/remounts every newly visited route. In this app
    // those route effects fetch data and replay entrance animations, so sidebar
    // navigation read as a real page flash. Keep the app shell stable by using
    // a custom client entry without StrictMode.
    client: { entry: "client" },
    server: { entry: "server" },
  },
});
