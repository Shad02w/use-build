import { defineConfig } from "tsup"
import { fileURLToPath } from "node:url"
import path from "node:path"

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    entry: [
        path.join(dirname, "./src/vite.ts"),
        path.join(dirname, "./src/rsbuild.ts"),
        path.join(dirname, "./src/rspack/loader.ts"),
        path.join(dirname, "./src/rspack/index.ts"),
        path.join(dirname, "./src/rsbuildv2/index.ts")
    ],
    skipNodeModulesBundle: true,
    external: ["vite", "@rsbuild/core", "@rspack/core", "express"],
    dts: true,
    outDir: path.join(__dirname, "./dist"),
    format: ["cjs", "esm"]
})
