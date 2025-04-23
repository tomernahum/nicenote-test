export type Bucket = "doc" | "awareness" // may make dynamic later

export type Update = {
    bucket: string
    rowId: number // row id of the update on the server
    operation: Uint8Array
}
export type UpdateOptRow = {
    rowId?: number
    bucket: Bucket
    operation: Uint8Array
}
export type UpdateFlex = {
    rowId?: number
    bucket: string
    operation: Uint8Array
}

export type ProviderEncryptionParams = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]
    // TODO: write key
}

let uorTypeCheckHelper: UpdateOptRow = {} as UpdateOptRow
uorTypeCheckHelper satisfies Omit<Update, "rowId">

let uFlexTypeCheckHelper: UpdateFlex = {} as UpdateFlex
uFlexTypeCheckHelper satisfies Omit<Update, "rowId">

export async function prettyUpdateObj(update: UpdateFlex) {
    const operationHash = await hashBinary(update.operation)
    let out: any = {
        bucket: update.bucket,
        operationHash,
        operationLength: update.operation.byteLength,
        operationFull: update.operation,
    }
    if (update.rowId !== undefined) {
        out.rowId = update.rowId
    }
    return out
}
export async function prettyUpdateString(update: UpdateFlex) {
    const u = await prettyUpdateObj(update)
    const out = `${u.rowId}: ${u.operationLength} byte update: ${
        u.operationHash
    }; full: ${btoa(u.operationFull)}`
    return out
}

async function hashBinary(buffer: Uint8Array) {
    const hashed = Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

    return hashed.slice(0, 10)
}

//* This function not written with cryptographic security in mind, just for display purposes */
async function hashString(str: string) {
    const buffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(str)
    )
    const hashed = Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

    return hashed.slice(0, 10)
}
