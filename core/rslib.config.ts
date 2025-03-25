import { defineConfig } from "@rslib/core"

export default defineConfig({
    lib: [
        {
            format: "esm",
            bundle: false,
            output: {
                distPath: {
                    root: "./dist/esm"
                }
            },
            dts: true
        },
        {
            format: "cjs",
            bundle: false,
            output: {
                distPath: {
                    root: "./dist/cjs"
                }
            },
            dts: true
        }
    ],
    output: {
        target: "node",
        cleanDistPath: true
    }
})
