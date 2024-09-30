import { createLogger, createViteRuntime, createServer as createViteServer, type Plugin, type ViteDevServer, type UserConfig } from "vite"
import { isBuildTimeFile, serializeModules } from "./util"

const name = "use-build"

export function UseBuildPlugin(): Plugin {
    const logger = createLogger("info", { prefix: `[${name}]` })
    let userConfig: UserConfig
    let server: ViteDevServer

    return {
        name: `vite:${name}`,
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
            if (!(await isBuildTimeFile(id, code))) return

            const runtime = await createViteRuntime(server)

            const start = Date.now()
            logger.info("\n")
            logger.info(`Running build time script: ${id}`, { timestamp: true })

            try {
                const modules = await runtime.executeEntrypoint(id)
                logger.info(`Done in ${Date.now() - start}ms`, { timestamp: true })
                return {
                    code: serializeModules(modules, id),
                    map: { mappings: "" }
                }
            } catch (e) {
                if (e instanceof Error) {
                    throw new Error(`Failed to run build time script: ${id} \n${e.message}\n${e.stack}`)
                }
                throw new Error(`Unknown execution error: ${e}`)
            }
        },
        async buildEnd() {
            await server.close()
        }
    }
}
