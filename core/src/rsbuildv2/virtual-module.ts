/**
 * This is heavily based on the source code from 'rspack-virtual-module' package.
 * ref: https://github.com/rspack-contrib/rspack-plugins/blob/main/packages/plugin-virtual-module/src/index.ts
 */
import type { RspackPluginInstance, Compiler } from "@rspack/core"
import path from "node:path"
import crypto from "node:crypto"
import fs from "node:fs"
import { logger } from "@rsbuild/core"

const PLUGIN_NAME = "rspack-virtual-module"

export class RspackVirtualModulePlugin implements RspackPluginInstance {
    #staticModules: Record<string, string>

    #tempDir: string

    static BaseDirectory = path.join(process.cwd(), "node_modules", ".use-build-virtual-module")

    static #allTempDirs: Set<string> = new Set()

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

        RspackVirtualModulePlugin.#allTempDirs.add(this.#tempDir)
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

        // This event will trigger when dev server is manually stopped, rsbuild will not trigger shutdown hook in this case
        process.on("SIGINT", () => {
            this.#clear()
            process.exit(0)
        })

        // This will trigger when build process is ending
        compiler.hooks.shutdown.tap(PLUGIN_NAME, () => {
            this.#clear()
        })
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

    /**
     * Cleanup the temporary directory, because rspack use temp directory to store the virtual module
     */
    #clear() {
        try {
            logger.info("[use-build] cleaning up the temporary directory")
            for (const tempDir of RspackVirtualModulePlugin.#allTempDirs) {
                fs.rmSync(tempDir, { recursive: true, force: true })
            }
        } catch {
            // noop
        }
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
