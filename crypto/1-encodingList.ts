const SIZE_PREFIX_LENGTH = 4 // note this. This will be annoying to change while maintaining backwards compatibility. luckily it won't need to change for a long time as there are technically 4+ billion possible values. or at least 26 * 1000

// all this code could probably be improved, but it does work.
// note this code shouldn't be security critical (unless it somehow exposes us to side channel timing attacks but the application logic would already probably do that if it were a problem)
function encode4ByteNumber(number: number) {
    if (number < 0 || number > 4_294_967_295) {
        throw new Error("Number out of bounds for 4-byte encoding")
    }
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setUint32(0, number, true) // little-endian
    return new Uint8Array(buffer)
}
function decode4ByteNumber(buffer: Uint8Array) {
    const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
    )
    return view.getUint32(0, true)
}
export function encodeList(listOfBinary: Uint8Array[]) {
    const outLength = listOfBinary.reduce((acc, item) => {
        return acc + item.byteLength + SIZE_PREFIX_LENGTH
    }, 0)
    const out = new Uint8Array(outLength)
    let currentOffset = 0

    if (SIZE_PREFIX_LENGTH !== 4) {
        throw new Error("SIZE_PREFIX_LENGTH must be 4 for current code to work")
    }
    for (const update of listOfBinary) {
        const lengthPrefix = encode4ByteNumber(update.byteLength)
        out.set(lengthPrefix, currentOffset)
        currentOffset += 4
        out.set(update, currentOffset)
        currentOffset += update.byteLength
    }
    return out
}
export function decodeList(encoded: Uint8Array) {
    const out: Uint8Array[] = []
    let currentOffset = 0

    if (SIZE_PREFIX_LENGTH !== 4) {
        throw new Error("SIZE_PREFIX_LENGTH must be 4 for current code to work")
    }
    while (currentOffset < encoded.byteLength) {
        const lengthPrefix = encoded.slice(currentOffset, currentOffset + 4)
        const length = decode4ByteNumber(lengthPrefix)
        currentOffset += 4
        const update = encoded.slice(currentOffset, currentOffset + length)
        currentOffset += length
        out.push(update)
    }
    return out
}

// Functions used by our crypto sequence:

export function encodeMultipleUpdatesAsOne(
    config: {},
    outgoingData: Uint8Array[]
): Uint8Array {
    return encodeList(outgoingData)
}
export function decodeMultiUpdate(
    config: {},
    incomingData: Uint8Array
): Uint8Array[] {
    return decodeList(incomingData)
}
