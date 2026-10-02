// Portable compiler path for Windows environments that cannot launch native esbuild.
const Module = require("node:module");
const wasm = require("esbuild-wasm");
const original = Module._load;
Module._load = function (name, ...rest) {
  return name === "esbuild" ? wasm : original.call(this, name, ...rest);
};
process.env.WRANGLER_LOG_PATH = "../work/wrangler-logs";
process.argv = [
  process.argv[0],
  "wrangler",
  "pages",
  "functions",
  "build",
  "--outdir",
  "../work/cloudflare-build",
];
Module._load(
  require.resolve("../node_modules/wrangler/wrangler-dist/cli.js"),
  null,
  true,
);
