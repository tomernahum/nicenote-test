// AI GENERATED

export function encodeOperations(
    data: { id: number; operation: Uint8Array }[]
): Uint8Array {
    let totalLength = 0
    for (const item of data) {
        totalLength += 4 + 4 + item.operation.length
    }

    const buffer = new Uint8Array(totalLength)
    const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
    )

    let offset = 0
    for (const item of data) {
        view.setUint32(offset, item.id, true)
        offset += 4

        view.setUint32(offset, item.operation.length, true)
        offset += 4

        buffer.set(item.operation, offset)
        offset += item.operation.length
    }

    return buffer
}

export function decodeOperations(
    buffer: Uint8Array
): { id: number; operation: Uint8Array }[] {
    const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
    )
    const result: { id: number; operation: Uint8Array }[] = []

    let offset = 0
    while (offset + 8 <= buffer.length) {
        const id = view.getUint32(offset, true)
        offset += 4

        const length = view.getUint32(offset, true)
        offset += 4

        if (offset + length > buffer.length) break

        const operation = buffer.slice(offset, offset + length)
        offset += length

        result.push({ id, operation })
    }

    return result
}

function test() {
    const sampleData = [
        {
            id: 21,
            operation: new Uint8Array([1, 2, 3]),
        },
        {
            id: 22,
            operation: new Uint8Array([4, 5, 6]),
        },
    ]

    console.log(encodeOperations(sampleData))
    console.log(decodeOperations(encodeOperations(sampleData)))
}
test()
