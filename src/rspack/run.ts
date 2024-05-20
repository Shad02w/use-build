import { createRequire } from "node:module"
import vm from "node:vm"
import fs from "node:fs"
import path from "node:path"

export async function runModule(id: string, code: string) {
    const fd = await fs.promises.open(process.cwd() + "/math.js", "w+")
    await fd.writeFile(code)

    const context = createContext(id)

    // copy from vite-node repo
    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${Object.keys(context).join(",")})=>{{`
    const source = `${codeDefinition}${code}\n}}`
    const options = {
        filename: context.__filename,
        lineOffset: 0,
        columnOffset: -codeDefinition.length
    }

    const fn = vm.runInThisContext(source, options)
    await fn(...Object.values(context))
    return context.module.exports
}

function createContext(id: string) {
    const require = createRequire(id)
    const module = {
        exports: {}
    }
    return {
        require,
        exports: module.exports,
        module: module,
        __dirname: path.dirname(id),
        __filename: id
    }
}
