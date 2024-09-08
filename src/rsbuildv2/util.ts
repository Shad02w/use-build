import { mergeRsbuildConfig, type RsbuildConfig } from "@rsbuild/core"
import type { ServerResponse } from "node:http"
import { RspackVirtualModulePlugin } from "./virtual-module"
import { PLUGIN_NAME } from "./index"

export function convertToNodeRsbuildConfig(userConfig: RsbuildConfig) {
    return mergeRsbuildConfig(userConfig, {
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
}

export function generateEntryVirtualModule() {
    return 'data:text/javascript,import {handler} from "use-build-runtime"; export {handler};'
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
