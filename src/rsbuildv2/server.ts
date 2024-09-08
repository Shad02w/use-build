import { createRsbuild, logger, mergeRsbuildConfig, type RsbuildConfig } from "@rsbuild/core"
import { convertToNodeRsbuildConfig, generateEntryVirtualModule, generateHandlerVirtualModule, getDevMiddleware } from "./util"
import path from "node:path"
import { serializeModules } from "../util"
import { RspackVirtualModulePlugin } from "./virtual-module"
import { runModule } from "./run-module"
import type { Compiler, Stats } from "@rspack/core"

type FS = typeof import("fs")

const BUILD_TIME_SERVER_PORT = 18900
const USE_BUILD_RUNTIME = "use-build-runtime"

logger.override({
    start: () => {}
})

export type RuntimeServer = {
    close: () => Promise<void>
    /**
     * get and start the handler function from the virtual module
     */
    init: () => Promise<Response>
    /**
     * @param resolvedPath - the absolute path of the build time file
     *
     * @returns code of esm modules after running the module
     */
    request: (resourcePath: string) => Promise<string>
}

type UseBuildServeOptions = {
    /**
     * the user rsbuild config, we will create a new rsbuild config to be used in the build-time server based on this config
     */
    userConfig: RsbuildConfig
    /**
     * the set of use-build files
     */
    fileSet: Set<string>
    onRebuild: () => void
}

export async function createUseBuildServer(options: UseBuildServeOptions): Promise<RuntimeServer> {
    let handler: ((path: string) => Promise<{ message: string }>) | null = null
    let outputFileSystem: FS | null = null
    let vmp: RspackVirtualModulePlugin
    let waitForNextBuildResolver: ((stats: Stats) => void) | null = null
    const fileSet = options.fileSet

    const rsbuild = await createRsbuild({
        rsbuildConfig: mergeRsbuildConfig(convertToNodeRsbuildConfig(options.userConfig), {
            source: {
                entry: {
                    index: generateEntryVirtualModule()
                }
            },
            tools: {
                rspack(_, { appendPlugins }) {
                    vmp = new RspackVirtualModulePlugin({
                        [USE_BUILD_RUNTIME]: generateHandlerVirtualModule(fileSet)
                    })
                    appendPlugins(vmp)
                }
            },
            server: {
                port: BUILD_TIME_SERVER_PORT,
                host: "localhost",
                printUrls: false
            }
        })
    })

    rsbuild.removePlugins(["rsbuild:progress", "rsbuild:file-size"])

    const compiler = (await rsbuild.createCompiler()) as Compiler
    const server = await rsbuild.createDevServer({ compiler, getPortSilently: true })

    compiler.hooks.afterEmit.tapPromise("use-build-runtime-runtime", async compilation => {
        // omit the first build
        if (!handler) return
        handler = await createHandler(compilation.getStats())
        logger.success("[use-build] rebuild")
        waitForNextBuildResolver?.(compilation.getStats())
        options.onRebuild()
    })

    server.middlewares.use("/init", async (_, res) => {
        const devMiddleware = getDevMiddleware(res)
        outputFileSystem = devMiddleware.outputFileSystem

        handler = await createHandler(devMiddleware.stats)
        res.end()
    })

    server.middlewares.use("/handle", async (req, res) => {
        if (!handler) {
            throw new Error("[use-build] should init the handler first before handling the request")
        }

        const fullURL = `http://${req.headers.host}${req.originalUrl}`
        let url: URL
        try {
            url = new URL(fullURL)
        } catch {
            throw new Error(`[use-build] invalid url: ${fullURL}`)
        }

        const resourcePath = url.searchParams.get("path") // absolute path
        if (!resourcePath) {
            throw new Error(`[use-build] 'path' should be provided in the query string to server`)
        }

        if (!fileSet.has(resourcePath)) {
            fileSet.add(resourcePath)
            vmp.writeModule(USE_BUILD_RUNTIME, generateHandlerVirtualModule(fileSet))
            // wait for the next build
            await waitForNextBuild()
        }

        const relativePath = RspackVirtualModulePlugin.getRelativePath(resourcePath)
        const result = await handler(relativePath)
        res.end(JSON.stringify(result))
    })

    const {
        port,
        server: { close }
    } = await server.listen()

    logger.success(`[use-build] build-time server started at port ${port}\n`)

    const createHandler = async (stats: Stats) => {
        if (!outputFileSystem) {
            throw new Error("[use-build] dev middleware outputFileSystem not found, unable to create the handler")
        }

        const outputPath = stats.toJson().outputPath
        if (!outputPath) {
            throw new Error("[use-build] output path not found in the stats")
        }

        // get handler function from the virtual module
        const code = outputFileSystem.readFileSync!(path.join(outputPath, "index.js"), "utf-8")

        const modules = await runModule(path.join(process.cwd(), ".virtual.js"), code)
        handler = Reflect.get(modules, "handler") as () => Promise<{ message: string }>
        if (!handler) {
            throw new Error("[use-build]: handler is missing in the virtual module")
        }
        return handler
    }
    const serverURL = `http://localhost:${port}`

    const waitForNextBuild = async () => {
        const wait = new Promise<Stats>(resolve => void (waitForNextBuildResolver = resolve))
        await wait
        waitForNextBuildResolver = null
        return
    }

    return {
        close,
        init: async () => await fetch(`${serverURL}/init`),
        request: async (resourcePath: string) => {
            const url = new URL(serverURL)
            url.pathname = "/handle"
            url.searchParams.set("path", resourcePath)

            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`[use-build] Oops! failed to handle the request for ${resourcePath}`)
            }
            const modules = await response.json()
            return serializeModules(modules, resourcePath)
        }
    }
}
