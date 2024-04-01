import { createLogger, createViteRuntime, createServer as createViteServer, type Plugin, ViteDevServer, UserConfig } from "vite"

const name = "vite-plugin-build-time"

export function buildTime(): Plugin {
    const logger = createLogger("info", { prefix: "[build-time]" })
    let userConfig: UserConfig
    let server: ViteDevServer

    return {
        name,
        config(c) {
            userConfig = c
        },
        async buildStart() {
            server = await createViteServer({
                ...userConfig,
                // prevent resolve config file automatically to avoid infinite loop
                configFile: false,
                server: {
                    hmr: false
                },
                ssr: {
                    noExternal: true
                },
                plugins: []
            })
        },
        async transform(code, id) {
            if (!(await isBuildTimeFile(code, id))) return

            const runtime = await createViteRuntime(server)

            const start = Date.now()
            logger.info(`Running build time script: ${id}`, { timestamp: true })
            const modules = await runtime.executeEntrypoint(id)
            logger.info(`Done in ${Date.now() - start}ms`, { timestamp: true })

            return serializeModules(modules, id)
        },
        async buildEnd() {
            await server.close()
        }
    }
}

async function isBuildTimeFile(code: string, filepath: string): Promise<boolean> {
    return /\.(j|t)sx?$/.test(filepath) && code.includes("use build") && (await haveUseBuildDirective(code))
}

async function haveUseBuildDirective(code: string): Promise<boolean> {
    const { parse } = await import("@swc/core")

    const module = await parse(code, {
        syntax: "typescript",
        tsx: true,
        script: true
    })

    return (
        module.body.findIndex(
            node => node.type === "ExpressionStatement" && node.expression.type === "StringLiteral" && node.expression.value === "use build"
        ) !== -1
    )
}

function serializeModules(modules: Record<string, unknown>, filepath: string): string {
    let content = ""
    for (const [exportName, module] of Object.entries(modules)) {
        const serialized = JSON.stringify(module)
        if (serialized.length === undefined && modules !== undefined) {
            throw new Error(`Failed to serialize ${exportName} in ${filepath}`)
        }

        if (exportName === "default") {
            content += `\nexport default ${serialized}`
        } else {
            content += `\nexport const ${exportName} = ${serialized}`
        }
    }
    return content
}
