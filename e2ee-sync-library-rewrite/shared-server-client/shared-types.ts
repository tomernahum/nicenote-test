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
    addUpdate: (
        docId: string,
        update: Uint8Array,
        callback: (
            result:
                | { success: true; rowId: number }
                | { success: false; errorMessage: string }
        ) => void
    ) => void
    applySnapshot: (
        docId: string,
        snapshot: Uint8Array,
        lastUpdateRowToReplace: number // | BigInt
    ) => void

    getDoc: (
        docId: string,
        callback: (
            docOperations: { id: number; operation: Uint8Array }[]
        ) => void
    ) => void
}
export interface InterServerEvents {}
export interface SocketData {}
