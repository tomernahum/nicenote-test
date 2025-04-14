export function encode4ByteNumber(number: number) {
    if (number < 0 || number > 4294967295) {
        throw new Error("Number out of bounds for 4-byte encoding")
    }
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setUint32(0, number, true) // little-endian
    return new Uint8Array(buffer)
}
export function decode4ByteNumber(buffer: Uint8Array) {
    const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
    )
    return view.getUint32(0, true)
}

const SIZE_PREFIX_LENGTH = 4
export function encodeList(listOfBinary: Uint8Array[]) {
    const outLength = listOfBinary.reduce((acc, item) => {
        return acc + item.byteLength + SIZE_PREFIX_LENGTH
    }, 0)
    const out = new Uint8Array(outLength)
    let currentOffset = 0
    for (const update of listOfBinary) {
        const lengthPrefix = encode4ByteNumber(update.byteLength)
        out.set(lengthPrefix, currentOffset)
        currentOffset += 4
        out.set(update, currentOffset)
        currentOffset += update.byteLength
    }
}
export function decodeList(encoded: Uint8Array) {
    const out: Uint8Array[] = []
    let currentOffset = 0
    while (currentOffset < encoded.byteLength) {
        const lengthPrefix = encoded.slice(currentOffset, currentOffset + 4)
        const length = decode4ByteNumber(lengthPrefix)
        currentOffset += 4
        const update = encoded.slice(currentOffset, currentOffset + length)
        currentOffset += length
        out.push(update)
    }
}
