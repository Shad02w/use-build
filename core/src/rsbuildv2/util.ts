import { mergeRsbuildConfig, type RsbuildConfig } from "@rsbuild/core"
import { connect } from "node:net"
import { RspackVirtualModulePlugin } from "./virtual-module"
import { PLUGIN_NAME } from "./index"
import { isOmittedPlugin } from "./omit"
import type { ServerResponse } from "node:http"

export function convertToNodeRsbuildConfig(userConfig: RsbuildConfig) {
    const merged = mergeRsbuildConfig(userConfig, {
        dev: {
            writeToDisk: false
        },
        output: {
            overrideBrowserslist: [],
            target: "node",
            emitAssets: false,
            polyfill: "off",
            minify: false,
            sourceMap: {
                js: false
            }
        },
        server: {
            publicDir: false
        },
        performance: {
            chunkSplit: {
                strategy: "all-in-one"
            }
        }
    })

    if (merged.performance?.bundleAnalyze) {
        merged.performance.bundleAnalyze = undefined
    }
    merged.plugins = []

    return merged
}

export function filterPlugins(config: RsbuildConfig) {
    return config.plugins?.filter(p => {
        if (!p) return false

        if (isOmittedPlugin(p)) {
            return false
        }

        if (typeof p === "object" && p !== null && "name" in p) {
            return p.name === PLUGIN_NAME ||
                // TODO: disable RsdoctorRspackPlugin, should have better solution
                p.name === "RsdoctorRspackPlugin"
                ? false
                : true
        }

        return true
    })
}

export function generateEntryVirtualModule(moduleName: string) {
    return `data:text/javascript,import {handler} from "${moduleName}"; export {handler};`
}

export function generateNotifierVirtualModule(date?: Date) {
    return `export const notifier = 'notifier${date ? date.getTime() : ""}';`
}

export function generateHandlerVirtualModule(useBuildFileSet: Set<string>) {
    const importPair = Array.from(useBuildFileSet)
        .map(RspackVirtualModulePlugin.getRelativePath)
        .map((path, index) => [`a${index}`, path])

    const importStatements = importPair.map(([variable, path]) => `import * as ${variable} from "${path}"`)
    const filepathToVariable = importPair.map(([variable, path]) => `"${path}":${variable}`)
    return `${importStatements.join(";")};export const handler = (path) => {return {${filepathToVariable.join(",")}}[path]};`
}

/**
 * Get the dev middleware from the response object of webpack dev server
 */
export function getDevMiddleware(res: ServerResponse) {
    const locals = Reflect.get(res, "locals")
    if (!locals?.webpack?.devMiddleware) {
        throw new Error("[use-build] devMiddleware not found, unable to handle use-build runtime request")
    }
    return locals.webpack.devMiddleware
}

const MAX_TRY_TIMES = 50
export async function resolveAvailablePort(host: string, port: number) {
    let tries = 0
    let currentPort = port

    while (tries < MAX_TRY_TIMES) {
        try {
            const available = await isPortAvailable(currentPort, host)
            if (available) {
                return currentPort
            }
            continue
        } catch {
            continue
        } finally {
            currentPort++
            tries++
        }
    }
}

function isPortAvailable(port: number, host: string, timeout: number = 1000): Promise<boolean> {
    return new Promise(resolve => {
        const socket = connect({
            port,
            host,
            timeout
        })

        // If we can connect, the port is in use
        socket.once("connect", () => {
            socket.end()
            resolve(false)
        })

        // If connection fails, the port is available
        socket.once("error", (err: NodeJS.ErrnoException) => {
            socket.destroy()
            // ECONNREFUSED means nothing is listening
            if (err.code === "ECONNREFUSED") {
                resolve(true)
            } else {
                // Other errors might mean the port is in use but not accepting connections
                resolve(false)
            }
        })

        // Handle timeout
        socket.once("timeout", () => {
            socket.destroy()
            resolve(false)
        })
    })
}
