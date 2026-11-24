import type { OpenNextConfig } from "@opennextjs/cloudflare";

const edgeConverter = () => import("./src/server/open-next-edge-converter.mjs").then((module) => module.default as any);

const config: OpenNextConfig = {
  // OpenNext's Cloudflare validator only accepts the built-in converter name.
  // This custom converter fixes the cookie CJS interop exception in the Worker.
  cloudflare: { dangerousDisableConfigValidation: true },
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: edgeConverter,
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
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
