import { createRsbuild, type RsbuildConfig, type RsbuildPlugin } from "@rsbuild/core"
import { isBuildTimeFile } from "../util"
import { convertToNodeRsbuildConfig } from "./util"

export async function prepare(userConfig: RsbuildConfig) {
    const useBuildFileSet = new Set<string>()
    const rsbuild = await createRsbuild({
        rsbuildConfig: userConfig
    })
    rsbuild.addPlugins([pluginUseBuildPrepare(useBuildFileSet)])

    const compiler = await rsbuild.createCompiler()
    const { createFsFromVolume, Volume } = await import("memfs")

    const fs = createFsFromVolume(new Volume())
    compiler.outputFileSystem = fs as any

    await rsbuild.build({ compiler })

    return useBuildFileSet
}

function pluginUseBuildPrepare(fileSet: Set<string>): RsbuildPlugin {
    return {
        name: "plugin-use-build-prepare",
        setup: api => {
            api.modifyRsbuildConfig({
                handler: config => convertToNodeRsbuildConfig(config),
                order: "post"
            })
            api.transform({ test: /\.(j|t)sx?$/ }, async ({ code, resourcePath }) => {
                if (await isBuildTimeFile(resourcePath, code)) {
                    fileSet.add(resourcePath)
                    return ""
                }
                return code
            })
        },
        remove: ["rsbuild:progress", "rsbuild:file-size"]
    }
}
