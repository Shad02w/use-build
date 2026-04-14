import { createServer as createViteServer, type Plugin, type ViteDevServer, type UserConfig, createLogger } from "vite"
import { isBuildTimeFile, serializeModules } from "./util"
import type { ModuleRunner } from "vite/module-runner"

const name = "use-build"

export function UseBuildPlugin(): Plugin {
    const logger = createLogger("info", { prefix: `[${name}]` })
    let userConfig: UserConfig
    let buildServer: ViteDevServer

    return {
        name: `vite:${name}`,
        config(config) {
            userConfig = config

            if (!config.environments) {
                config.environments = {}
            }
        },
        async buildStart() {
            buildServer = await createViteServer({
                ...userConfig,
                // prevent resolve config file automatically to avoid infinite loop
                configFile: false,
                server: {
                    hmr: false
                },
                ssr: {
                    noExternal: true
                },
                environments: {
                    ssr: {}
                },
                plugins: []
            })
        },
        transform: {
            filter: {
                code: {
                    include: ["use build"],
                    ignoreCase: true
                }
            },
            handler: async function (code, id) {
                if (!(await isBuildTimeFile(id, code))) return

                const start = Date.now()
                logger.info("\n")
                logger.info(`Running build time script: ${id}`, { timestamp: true })

                const ssrEnv = buildServer.environments.ssr
                const runner = (ssrEnv as any)["runner"] as ModuleRunner

                try {
                    const modules = await runner.import(id)
                    logger.info(`Done in ${Date.now() - start}ms`, { timestamp: true })

                    const currentModule = buildServer.moduleGraph.getModuleById(id)

                    Array.from(currentModule?.importedModules ?? []).forEach(m => {
                        if (m.id) {
                            this.addWatchFile(m.id)
                        }
                    })

                    return serializeModules(modules, id)
                } catch (e) {
                    if (e instanceof Error) {
                        throw new Error(`Failed to run build time script: ${id} \n${e.message}\n${e.stack}`)
                    }
                    throw new Error(`Unknown execution error: ${e}`)
                }
            }
        },
        async buildEnd() {
            await buildServer.close()
        }
    }
}
