import { type RsbuildPlugin } from "@rsbuild/core"
import { prepare } from "./prepare"
import { createUseBuildServer, type RuntimeServer } from "./server"
import { isBuildTimeFile } from "../util"
import { RspackVirtualModulePlugin } from "./virtual-module"
import { filterPlugins, generateNotifierVirtualModule } from "./util"

const USE_BUILD_NOTIFIER = "use-build-notifier"

export { omit } from "./omit"
export const PLUGIN_NAME = "plugin-use-build-v2"

export function pluginUseBuildV2(): RsbuildPlugin {
    let server: RuntimeServer | null = null
    let vmp: RspackVirtualModulePlugin

    return {
        name: PLUGIN_NAME,
        setup(api) {
            api.modifyBundlerChain(chain => {
                vmp = new RspackVirtualModulePlugin({
                    [USE_BUILD_NOTIFIER]: generateNotifierVirtualModule()
                })
                chain.plugin("use-build:virtual-module").use(vmp)
            })

            api.onAfterCreateCompiler(async () => {
                let userConfig = api.getRsbuildConfig()
                userConfig = {
                    ...userConfig,
                    plugins: filterPlugins(userConfig)
                }
                const fileSet = await prepare(userConfig)

                server = await createUseBuildServer({
                    userConfig: userConfig,
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
