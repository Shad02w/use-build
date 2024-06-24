import { type RsbuildPlugin } from "@rsbuild/core"
import { prepare } from "./prepare"
import { createUseBuildServer, type RuntimeServer } from "./server"
import { isBuildTimeFile } from "../util"
import { RspackVirtualModulePlugin } from "./virtual-module"
import { generateNotifierVirtualModule } from "./util"

const USE_BUILD_NOTIFIER = "use-build-notifier"

export function pluginUseBuildV2(): RsbuildPlugin {
    let server: RuntimeServer | null = null
    let vmp: RspackVirtualModulePlugin

    return {
        name: "plugin-use-build-v2",
        setup(api) {
            api.modifyBundlerChain(chain => {
                vmp = new RspackVirtualModulePlugin({
                    [USE_BUILD_NOTIFIER]: generateNotifierVirtualModule()
                })
                chain.plugin("use-build:virtual-module").use(vmp)
            })

            api.onAfterCreateCompiler(async () => {
                const userConfig = api.getRsbuildConfig()
                const fileSet = await prepare(userConfig)

                server = await createUseBuildServer({
                    userConfig,
                    fileSet,
                    onRebuild() {
                        vmp.writeModule(USE_BUILD_NOTIFIER, generateNotifierVirtualModule(new Date()))
                    }
                })

                await server.init()
            })

            api.onAfterBuild(async () => {
                if (server) {
                    await server.close()
                    server = null
                }
            })

            api.transform({ test: /\.(j|t)sx?$/ }, async ({ code, resourcePath, addDependency }) => {
                if (!(await isBuildTimeFile(resourcePath, code))) {
                    return code
                }

                addDependency(vmp.getRealPath(USE_BUILD_NOTIFIER))

                if (!server) {
                    throw new Error("use build runtime server is not running")
                }

                const source = await server.request(resourcePath)
                return source
            })
        }
    }
}
