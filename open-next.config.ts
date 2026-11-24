import type { OpenNextConfig } from "@opennextjs/cloudflare";

const edgeConverter = () => import("./src/server/open-next-edge-converter.mjs").then((module) => module.default as any);
const incrementalCache = async () => {
  const [{ default: r2IncrementalCache }, { withRegionalCache }] = await Promise.all([
    import("@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"),
    import("@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"),
  ]);
  return withRegionalCache(r2IncrementalCache, { mode: "long-lived" });
};
const revalidationQueue = () => import("@opennextjs/cloudflare/overrides/queue/do-queue").then((module) => module.default);

const config: OpenNextConfig = {
  // Cache les pages ISR et les résultats `unstable_cache` dans R2, avec le
  // cache régional Workers pour accélérer les lectures répétées à chaque POP.
  dangerous: { enableCacheInterception: true },
  // OpenNext's Cloudflare validator only accepts the built-in converter name.
  // This custom converter fixes the cookie CJS interop exception in the Worker.
  cloudflare: { dangerousDisableConfigValidation: true },
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: edgeConverter,
      proxyExternalRequest: "fetch",
      incrementalCache,
      tagCache: "dummy",
      queue: revalidationQueue,
    },
  },

  edgeExternals: ["node:crypto"],

  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: edgeConverter,
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
};

export default config;
