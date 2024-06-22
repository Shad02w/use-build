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

// TODO: remove filepath parameter
export function serializeModules(modules: Record<string, unknown>, filepath: string): string {
    let content = ""
    for (const [exportName, module] of Object.entries(modules)) {
        const serialized = JSON.stringify(module)
        if (serialized.length === undefined && modules !== undefined) {
            throw new Error(`Failed to serialize ${exportName} in ${filepath}`)
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
