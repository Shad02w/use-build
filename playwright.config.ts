import { defineConfig } from "@playwright/test"
import path from "node:path"

const rootDir = import.meta.dirname
const viteFixtures = ["vite-6-react", "vite-7-react", "vite-8-react"] as const
const serverModes = ["dev", "preview"] as const
const host = "127.0.0.1"
const basePort = Number(process.env.E2E_BASE_PORT ?? 43100)

type ServerMode = (typeof serverModes)[number]

const getPort = (fixtureIndex: number, mode: ServerMode) => basePort + fixtureIndex * 2 + (mode === "preview" ? 1 : 0)
const getServerUrl = (fixtureIndex: number, mode: ServerMode) => `http://${host}:${getPort(fixtureIndex, mode)}`

const viteFixtureRuns = viteFixtures.flatMap((fixtureName, fixtureIndex) =>
    serverModes.map(mode => ({
        fixtureName,
        fixtureIndex,
        mode,
        port: getPort(fixtureIndex, mode),
        url: getServerUrl(fixtureIndex, mode),
        projectName: `${fixtureName}:${mode}`
    }))
)

const webServer = viteFixtureRuns.map(({ fixtureName, mode, port, projectName, url }) => {
    const cwd = path.join(rootDir, "e2e", fixtureName)
    const viteArgs = `--host ${host} --port ${port} --strictPort`

    return {
        name: projectName,
        cwd,
        command: mode === "dev" ? `pnpm exec vite ${viteArgs}` : `pnpm build && pnpm exec vite preview ${viteArgs}`,
        url,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe" as const,
        stderr: "pipe" as const,
        gracefulShutdown: { signal: "SIGTERM" as const, timeout: 5_000 }
    }
})

const projects = viteFixtureRuns.map(({ fixtureName, mode, projectName, url }) => ({
    name: projectName,
    use: {
        baseURL: url
    },
    metadata: {
        fixtureName,
        mode
    }
}))

export default defineConfig({
    testDir: "./e2e",
    testMatch: "use-build.spec.ts",
    fullyParallel: false,
    workers: 1,
    projects,
    reporter: process.env.CI ? "github" : "list",
    use: {
        trace: "on-first-retry"
    },
    webServer
})
