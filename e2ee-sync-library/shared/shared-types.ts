// TODO, export hono types (there is a way)

// Hono type exporting was not working properly

// Socket.io Types
export interface ServerToClientEvents {
    newUpdate: (
        docId: string,
        update: Uint8Array,
        updateRow: number // | BigInt
    ) => void
}
export interface ClientToServerEvents {
    startListeningToDoc: (docId: string) => void
    stopListeningToDoc: (docId: string) => void
    addUpdate: (docId: string, update: Uint8Array) => void
    applySnapshot: (
        docId: string,
        snapshot: Uint8Array,
        lastUpdateRowToReplace: number // | BigInt
    ) => void
}
export interface InterServerEvents {}
export interface SocketData {}
