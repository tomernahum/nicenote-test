import { decodeList, encodeList } from "./1-encodingList"

export type VersionConfig = {
    schemaVersion?: string
    backwardsCompatibleSchemaVersions?: string[]
}
export const DEFAULT_VERSION_CONFIG = {
    schemaVersion: "v0001",
    backwardsCompatibleSchemaVersions: ["v0001"],
}

type Config = typeof DEFAULT_VERSION_CONFIG & VersionConfig

export function addVersion(config: Config, message: Uint8Array) {
    const versionBytes = new TextEncoder().encode(config.schemaVersion)
    return encodeList([versionBytes, message])
}

export function stripOffVersionAndConfirmItIsValid(
    config: Config,
    incomingData: Uint8Array
) {
    const [versionBytes, strippedMessage] = decodeList(incomingData)
    if (!versionBytes || !strippedMessage) {
        throw new Error("Invalid data")
    }
    const versionString = new TextDecoder().decode(versionBytes)
    if (
        versionString !== config.schemaVersion &&
        !config.backwardsCompatibleSchemaVersions.includes(versionString)
    ) {
        throw new Error("Invalid version")
    }
    return [strippedMessage, versionString] as const
    // caller can then do different things based on the version
}
