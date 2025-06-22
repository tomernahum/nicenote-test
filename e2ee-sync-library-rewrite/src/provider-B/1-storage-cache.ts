import { ClientUpdate } from "../-types"

export function createInMemoryStorageCache() {
    let state: ClientUpdate[] = []
    return {
        async addUpdate(update: ClientUpdate) {
            state.push(update)
        },
        async setState(updates: ClientUpdate[]) {
            state = updates
        },
        async getState() {
            return state
        },
    }
}

export type StorageCache = ReturnType<typeof createInMemoryStorageCache>
