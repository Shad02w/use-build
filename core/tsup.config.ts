import { defineConfig } from "tsup"

export default defineConfig({
    entry: ["./src/vite.ts", "./src/rsbuildv2/index.ts"],
    skipNodeModulesBundle: true,
    external: ["vite", "@rsbuild/core", "@rspack/core", "express"],
    dts: true,
    outDir: "./dist",
    clean: true,
    format: ["cjs", "esm"]
})
