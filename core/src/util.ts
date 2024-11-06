export const APP_NAME = "use-build"

export async function isBuildTimeFile(filepath: string, code: string): Promise<boolean> {
    return /\.(j|t)sx?$/.test(filepath) && code.includes("use build") && (await haveUseBuildDirective(code))
}

async function haveUseBuildDirective(code: string): Promise<boolean> {
    const { parse } = await import("@swc/core")

    const module = await parse(code, {
        syntax: "typescript",
        tsx: true,
        script: true
    })

    return (
        module.body.findIndex(
            node => node.type === "ExpressionStatement" && node.expression.type === "StringLiteral" && node.expression.value === "use build"
        ) !== -1
    )
}

const UNSUPPORTED_TYPES = new Set(["bigint", "symbol", "function"])

class ModuleSerializationError extends Error {
    override name = "ModuleSerializationError"
    constructor(message: string) {
        super(`${APP_NAME} only supports serializing JSON-compatible types.\n${message}`)
    }
}

// TODO: remove filepath parameter
export function serializeModules(modules: Record<string, unknown>, filepath: string): string {
    let content = ""
    for (const [exportName, module] of Object.entries(modules)) {
        if (UNSUPPORTED_TYPES.has(typeof module)) {
            throw new ModuleSerializationError(`Failed to serialize '${exportName}' in ${filepath} because it is a '${typeof module}' type`)
        }

        let serialized = undefined
        try {
            serialized = JSON.stringify(module)
        } catch {
            throw new ModuleSerializationError(`Failed to serialize '${exportName}' in ${filepath} because JSON.stringify failed`)
        }

        if (module !== undefined && serialized === undefined) {
            throw new ModuleSerializationError(`Failed to serialize '${exportName}' in ${filepath}`)
        }

        if (exportName === "default") {
            content += `\nexport default ${serialized}`
        } else {
            content += `\nexport const ${exportName} = ${serialized}`
        }
    }
    return content
}

export async function createMemFs() {
    const { createFsFromVolume, Volume } = await import("memfs")
    return createFsFromVolume(new Volume()) as any
}
