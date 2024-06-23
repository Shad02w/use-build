import { rspack, type Compiler, type RspackPluginInstance } from "@rspack/core"

const PLUGIN_NAME = "rspack:use-build"

export class UseBuildPlugin implements RspackPluginInstance {
    runtimeCompiler: Compiler | null = null
    apply(compiler: Compiler) {
        compiler.hooks.environment.tap(PLUGIN_NAME, () => {
            const runtimeOptions = { ...compiler.options }
            compiler.options.module.rules.unshift({
                test: /\.(j|t)sx?$/,
                loader: "use-build/loader",
                options: {
                    runtimeOptions
                }
            })

            runtimeOptions.plugins = compiler.options.plugins.filter(
                p => !(p instanceof UseBuildPlugin || p instanceof rspack.ProgressPlugin)
            )
            runtimeOptions.target = ["node", "es2015"]
            runtimeOptions.output = {}
            runtimeOptions.module = { ...compiler.options.module, rules: [...compiler.options.module.rules] }
            runtimeOptions.module.rules?.shift()
            runtimeOptions.stats = {
                preset: "errors-warnings",
                colors: true,
                timings: true
            }

            runtimeOptions.optimization = { ...compiler.options.optimization, splitChunks: false }
        })
    }
}
