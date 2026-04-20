import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { UseBuildPlugin } from "use-build/vite"

// https://vite.dev/config/
export default defineConfig({
    environments: {},
    plugins: [react(), UseBuildPlugin()]
})
