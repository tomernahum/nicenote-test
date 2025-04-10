export async function promiseAllSettled<T extends any>(promises: Promise<T>[]) {
    const x = await Promise.allSettled(promises)
    return {
        fulfilled: x
            .filter((r) => r.status === "fulfilled")
            .map((r) => r.value),
        rejected: x.filter((r) => r.status === "rejected").map((r) => r.reason),
    }
}
