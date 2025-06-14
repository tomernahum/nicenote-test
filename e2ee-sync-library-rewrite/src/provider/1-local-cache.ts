import { ClientUpdate } from "../-types"

// TODO: extract away storage interface into minimal things and then pass it into it
type StorageInterface = {}

type UpdateWithId = {
    update: ClientUpdate //Uint8Array
    id: string
}

export function createLocalStorageCache() {
    const lastSeenCanonicalState = []
    const unconfirmedOptimisticUpdates = []
    return {
        async addOptimisticUpdate(update: ClientUpdate, identifier: string) {
            return
        },
        async revokeOptimisticUpdate(identifier) {
            return
        },
        async addCanonicalUpdate(update: ClientUpdate, identifier?: string) {
            return
        },
        async setCanonicalState(updates: ClientUpdate[]) {
            return
        },

        async getCanonicalState() {
            return [] as UpdateWithId[]
        },
        async getUnconfirmedOptimisticUpdates() {
            return [] as UpdateWithId[]
        },
        async getStateWithOptimistic() {
            return [] as UpdateWithId[]
        },
    }
}

export function createInMemoryCache() {
    return createLocalStorageCache()
}
