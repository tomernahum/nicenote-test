export type PaddingConfig = {
    paddingLengthCheckpoints?: number[]
}
export const DEFAULT_PADDING_CONFIG_VALUES = {
    paddingLengthCheckpoints: [256, 2048, 16_384, 65_536, 262144],
}

type Config = typeof DEFAULT_PADDING_CONFIG_VALUES & PaddingConfig

export function padData(config: Config, data: Uint8Array) {
    const dataLength = data.byteLength
    const padTarget = config.paddingLengthCheckpoints.find(
        (checkpoint) => checkpoint >= dataLength + 1 // 1 bit for the padding indicator
    )
    if (!padTarget) {
        throw new Error("Data is too long to encrypt")
    }
    const paddedData = new Uint8Array(padTarget)
    paddedData.set(data)
    paddedData[dataLength] = 0x80
    // the rest should be 0-filled
    return paddedData
}

export function unPadData(config: Config, paddedData: Uint8Array) {
    let i = paddedData.length - 1

    // Skip all 0x00 bytes from the end
    while (i >= 0 && paddedData[i] === 0x00) {
        i--
    }

    // Expect 0x80 as the first non-zero padding byte
    if (i < 0 || paddedData[i] !== 0x80) {
        throw new Error("Invalid padding")
    }

    // Return everything before the 0x80 padding byte
    return paddedData.slice(0, i)
}
