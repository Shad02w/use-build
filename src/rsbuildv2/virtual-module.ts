/**
 * This is heavily based on the source code from 'rspack-virtual-module' package.
 * ref: https://github.com/rspack-contrib/rspack-plugins/blob/main/packages/plugin-virtual-module/src/index.ts
 */
import type { RspackPluginInstance, Compiler } from "@rspack/core"
import path from "node:path"
import crypto from "node:crypto"
import fs from "node:fs"

export class RspackVirtualModulePlugin implements RspackPluginInstance {
    #staticModules: Record<string, string>

    #tempDir: string

    static BaseDirectory = path.join(process.cwd(), "node_modules", ".use-build-virtual-module")

    /**
     * Get the relative path of the virtual module fro a given file in the file system
     */
    static getRelativePath(resourcePath: string) {
        return path.relative(path.join(RspackVirtualModulePlugin.BaseDirectory, "hash"), resourcePath)
    }

    constructor(staticModules: Record<string, string>) {
        this.#staticModules = staticModules
        if (!fs.existsSync(RspackVirtualModulePlugin.BaseDirectory)) {
            fs.mkdirSync(RspackVirtualModulePlugin.BaseDirectory, { recursive: true })
        }

        const hash = crypto.createHash("md5").update(JSON.stringify(this.#staticModules)).digest("hex").slice(0, 8)
        this.#tempDir = path.join(RspackVirtualModulePlugin.BaseDirectory, hash)

        if (!fs.existsSync(this.#tempDir)) {
            fs.mkdirSync(this.#tempDir)
        }
    }

    apply(compiler: Compiler) {
        // Write the modules to the disk
        Object.entries(this.#staticModules).forEach(([path, content]) => {
            this.writeModule(path, content)
        })
        const originalResolveModulesDir = compiler.options.resolve.modules || ["node_modules"]
        compiler.options.resolve.modules = [...originalResolveModulesDir, this.#tempDir]
        compiler.options.resolve.alias = {
            ...compiler.options.resolve.alias,
            ...Object.keys(this.#staticModules).reduce(
                (acc, p) => {
                    acc[p] = this.#normalizePath(p)
                    return acc
                },
                {} as Record<string, string>
            )
        }
        process.on("SIGINT", this.#clear.bind(this))
        process.on("exit", this.#clear.bind(this))
    }

    async writeModule(modulePath: string, content: string) {
        const normalizedPath = this.#normalizePath(modulePath)
        await ensureDirectory(path.dirname(normalizedPath))
        return await fs.promises.writeFile(normalizedPath, content)
    }

    /**
     * Get absolute path of the virtual module in the file system
     */
    getRealPath(modulePath: string) {
        if (modulePath in this.#staticModules) {
            return this.#normalizePath(modulePath)
        }
        throw new Error(`Module ${modulePath} is not a virtual module`)
    }

    #clear() {
        console.log(this.#tempDir)
        return fs.rmSync(this.#tempDir, { recursive: true })
    }

    #normalizePath(p: string) {
        const ext = path.extname(p)
        return path.join(this.#tempDir, ext ? p : `${p}.js`)
    }
}

async function ensureDirectory(directory: string) {
    if (fs.existsSync(directory)) return

    return fs.promises.mkdir(directory, { recursive: true })
}
