import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginUseBuild } from "use-build/rsbuild"

export default defineConfig({
    plugins: [pluginReact(), pluginUseBuild()]
})
