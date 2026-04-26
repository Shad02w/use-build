import {
    createServer as createViteServer,
    type Plugin,
    type ViteDevServer,
    type UserConfig,
    createLogger,
    isRunnableDevEnvironment
} from "vite"
import { isBuildTimeFile, serializeModules } from "./util"

const name = "use-build"

export function UseBuildPlugin(): Plugin {
    const logger = createLogger("info", { prefix: `[${name}]` })
    let userConfig: UserConfig
    let buildServer: ViteDevServer
    let importQueue: Promise<void> = Promise.resolve()

    /*
     * Vite can transform related "use build" modules concurrently:
     *
     *   time 1: transform(A) -> runner.import(A) -> imports shared dependency B
     *   time 2: transform(B) -> runner.import(B) starts before time 1 has finished
     *
     * If both runner imports overlap, B may be evaluated through both paths before the runner
     * cache settles. Queue top-level runner imports so one build-time graph finishes first.
     */
    const runBuildTimeImport = async <T>(loader: () => Promise<T>): Promise<T> => {
        const result = importQueue.then(loader, loader)
        importQueue = result.then(
            () => undefined,
            () => undefined
        )
        return result
    }

    return {
        name: `vite:${name}`,
        config(config) {
            userConfig = config

            if (!config.environments) {
                config.environments = {}
            }
        },
        async buildStart() {
            importQueue = Promise.resolve()
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

                try {
                    const ssrEnv = buildServer.environments.ssr
                    if (!isRunnableDevEnvironment(ssrEnv)) {
                        throw new Error("SSR environment is not runnable")
                    }

                    const runner = ssrEnv.runner

                    const modules = await runBuildTimeImport(() => runner.import(id))
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

export { UseBuildPlugin as useBuild }
