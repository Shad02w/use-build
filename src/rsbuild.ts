import { createRsbuild, logger, type RsbuildConfig, type RsbuildPlugin } from "@rsbuild/core"
import vm from "node:vm"
import { createRequire } from "node:module"
import path from "node:path"
import { isBuildTimeFile, serializeModules } from "./util"

const PLUGIN_NAME = "use-build"
const BUNDLE_FILENAME = "bundle.js"
const RUNTIME_DIST = "/dist"

logger.override({
    ready: () => {},
    info: () => {}
})

export function pluginUseBuild(): RsbuildPlugin {
    return {
        name: PLUGIN_NAME,
        setup: async api => {
            api.transform({ test: /\.(j|t)sx?$/ }, async ({ code, resourcePath }) => {
                if (!(await isBuildTimeFile(resourcePath, code))) {
                    return code
                }
                return buildModules(resourcePath, api.getRsbuildConfig())
            })
        }
    }
}

async function buildModules(entry: string, userConfig: RsbuildConfig) {
    const rsbuild = await createRsbuild({ rsbuildConfig: userConfig })
    rsbuild.addPlugins([
        pluginUseBuildRuntime({
            entry,
            output: {
                dist: RUNTIME_DIST,
                filename: BUNDLE_FILENAME
            }
        })
    ])

    const compiler = await rsbuild.createCompiler()
    const { createFsFromVolume, Volume } = await import("memfs")

    const fs = createFsFromVolume(new Volume())
    compiler.outputFileSystem = fs as any

    await rsbuild.build({ compiler })

    const bundle = await fs.promises.readFile(path.join(RUNTIME_DIST, "server", BUNDLE_FILENAME))

    try {
        const module = await runModule(entry, bundle.toString())
        return serializeModules(module, entry)
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(`Failed to run build time file ${entry}: ${e.message}`)
        }
        throw e
    } finally {
        compiler.close(() => {})
    }
}

async function runModule(id: string, code: string) {
    const context = createContext(id)

    const codeDefinition = `'use strict';async (${Object.keys(context).join(",")})=>{{`
    const source = `${codeDefinition}${code}\n}}`
    const options = {
        filename: context.__filename,
        lineOffset: 0,
        columnOffset: -codeDefinition.length
    }

    const fn = vm.runInThisContext(source, options)
    await fn(...Object.values(context))
    return context.module.exports
}

function createContext(id: string) {
    const require = createRequire(id)
    const module = {
        exports: {}
    }
    return {
        require,
        exports: module.exports,
        module: module,
        __dirname: path.dirname(id),
        __filename: id
    }
}

function pluginUseBuildRuntime({
    entry,
    output
}: {
    entry: string
    output: {
        dist: string
        filename: string
    }
}): RsbuildPlugin {
    return {
        name: PLUGIN_NAME + "-runtime",
        setup: async api => {
            api.modifyRsbuildConfig(config => {
                config.output!.targets = ["node"]
                config.source!.entry = {
                    bundle: entry
                }
                config.performance!.chunkSplit!.strategy = "all-in-one"
                config.output!.distPath!.root = output.dist
                config.output!.filename!.js = output.filename
                config.output!.cleanDistPath = true
            })

            api.modifyRspackConfig(config => {
                config.stats = {
                    preset: "errors-warnings",
                    colors: true,
                    timings: true
                }
            })
        },
        remove: [
            // TODO: file-size does not work with custom output file system of the compiler
            "rsbuild:file-size",
            "rsbuild:progress"
        ]
    }
}
