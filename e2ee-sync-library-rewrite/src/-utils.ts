// by o4-mini

/**
 * Return a version of `fn` with its first argument fixed to `first`.
 *
 * @param fn    – original function of shape (first: A, ...rest: Rest) => R
 * @param first – the value to bind as the first argument
 * @returns     – a function (...rest: Rest) => R
 */
export function bindFirst<A, Rest extends any[], R>(
    fn: (first: A, ...rest: Rest) => R,
    first: A
): (...rest: Rest) => R {
    return (...rest: Rest) => fn(first, ...rest)
}
export type BoundFirstAll<T> = {
    [K in keyof T]: T[K] extends (
        first: infer A,
        ...rest: infer Rest
    ) => infer R
        ? (...args: Rest) => R
        : T[K]
}

type Success<T> = {
    data: T
    error: null
}
type Failure<E> = {
    data: null
    error: E
}
type Result<T, E = Error> = Success<T> | Failure<E>
export async function tryCatch<T, E = Error>(
    promise: Promise<T>
): Promise<Result<T, E>> {
    try {
        const data = await promise
        return { data, error: null }
    } catch (error) {
        return { data: null, error: error as E }
    }
}

export async function tryCatch2<T, E = Error>(
    promise: Promise<T>
): Promise<[T, null] | [null, E]> {
    try {
        const data = await promise
        return [data, null] as const
    } catch (error) {
        return [null, error as E] as const
    }
}

export function tryCatch2SyncFn<T, E = Error>(
    fn: () => T
): [T, null] | [null, E] {
    try {
        const data = fn()
        return [data, null] as const
    } catch (error) {
        return [null, error as E] as const
    }
}

export function doIf<T>(condition: boolean, fn: () => T) {
    if (condition) {
        return fn()
    } else return undefined
}
