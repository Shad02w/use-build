import { type Compiler, type Stats, type LoaderDefinition, type RspackOptions } from "@rspack/core"
import { isBuildTimeFile, serializeModules } from "../util"
import { runModule } from "./run"

const BUNDLE_FILENAME = "bundle.js"

const useBuildLoader: LoaderDefinition = async function (this, source) {
    if (!(await isBuildTimeFile(this.resourcePath, source))) return source
    const options = this.getOptions()
    const id = this.resourcePath

    if (!("runtimeOptions" in options)) {
        throw new Error("runtimeOptions is required")
    }

    const { rspack } = await import("@rspack/core")

    const rspackOptions = options.runtimeOptions as RspackOptions

    rspackOptions.entry = id
    rspackOptions.output = {
        path: "/",
        filename: BUNDLE_FILENAME,
        library: {
            type: "commonjs-module"
        }
    }

    const compiler = rspack(rspackOptions)
    const { createFsFromVolume, Volume } = await import("memfs")

    const fs = createFsFromVolume(new Volume())
    compiler.outputFileSystem = fs as any

    const stats = await runCompiler(compiler)

    if (stats?.hasErrors()) {
        // TODO: more precise error handling
        throwCompilerErrors(stats)
    }

    const code = await fs.promises.readFile("/" + BUNDLE_FILENAME, "utf-8")

    try {
        const modules = await runModule(id, code.toString())
        return serializeModules(modules, id)
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(`Failed to run build time file ${id}: ${e.message}`)
        }
        throw e
    } finally {
        compiler.close(() => {})
    }
}

const runCompiler = (compiler: Compiler) =>
    new Promise<Stats | undefined>((resolve, reject) => {
        compiler.run((err, stats) => {
            if (err) {
                reject(err)
                return
            }
            resolve(stats)
        })
    })

function throwCompilerErrors(stats: Stats): never {
    let messages: string[] = []
    for (const err of stats.compilation.errors) {
        if (err) {
            messages.push(err?.message)
        }
    }

    throw new Error(messages.join("\n"))
}

export default useBuildLoader
