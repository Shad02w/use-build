import type { RsbuildPlugin, RsbuildPlugins } from "@rsbuild/core"

const OMIT_PLUGIN_MAKER = "use-build-omit"

export function omit(plugin: RsbuildPlugin): RsbuildPlugin {
    Reflect.set(plugin, OMIT_PLUGIN_MAKER, true)
    return plugin
}

export function isOmittedPlugin(plugin: RsbuildPlugins[number]): boolean {
    if (!plugin) return false
    return Reflect.has(plugin, OMIT_PLUGIN_MAKER)
}
