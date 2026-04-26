import { expect, test, type Page } from "@playwright/test"

type BuildValues = {
    uuid: string
    postId: string
    userId: string
}

const readBuildValues = async (page: Page): Promise<BuildValues> => {
    return page.evaluate(() => {
        const read = (testId: string, label: string) => {
            const el = document.querySelector(`[data-testid="${testId}"]`)

            if (!el) {
                throw new Error(`Missing element data-testid="${testId}"`)
            }

            const text = (el.textContent ?? "").trim()
            const prefix = `${label}: `

            if (!text.startsWith(prefix)) {
                throw new Error(`Expected ${testId} to start with "${prefix}", received "${text}"`)
            }

            return text.slice(prefix.length)
        }

        const uuid = read("build-uuid", "uuid")

        return {
            uuid,
            postId: read("build-post-id", "postId"),
            userId: read("build-user-id", "userId")
        }
    })
}

const expectCalculatedValues = (values: Awaited<ReturnType<typeof readBuildValues>>) => {
    expect(values.uuid).toBeTruthy()
    expect(values.postId).toBe(`post-${values.uuid}`)
    expect(values.userId).toBe(`user-${values.uuid}`)
}

const logBuildValues = (projectName: string, phase: "before-refresh" | "after-refresh", values: BuildValues) => {
    console.log(`[${projectName}] ${phase}`, values)
}

test("use-build values are stable after refresh", async ({ page }, testInfo) => {
    await page.goto("/")
    await expect(page.getByTestId("build-values")).toBeVisible()

    const beforeRefresh = await readBuildValues(page)
    logBuildValues(testInfo.project.name, "before-refresh", beforeRefresh)
    expectCalculatedValues(beforeRefresh)

    await page.reload()
    await expect(page.getByTestId("build-values")).toBeVisible()

    const afterRefresh = await readBuildValues(page)
    logBuildValues(testInfo.project.name, "after-refresh", afterRefresh)
    expectCalculatedValues(afterRefresh)
    expect(afterRefresh).toEqual(beforeRefresh)
})
