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
