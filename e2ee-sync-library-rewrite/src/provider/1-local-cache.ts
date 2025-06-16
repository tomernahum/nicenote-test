import { ClientUpdate } from "../-types"

// TODO: extract away storage interface into minimal things and then pass it into it
type StorageInterface = {}

type UpdateWithId = {
    update: ClientUpdate //Uint8Array
    id: string
}

/** This is two caches in a trench coat:
 * - a cache of canonical (confirmed) updates
 * - a cache of optimistic updates
 *
 *  online mode updates are intended to use the optimistic cache first, then once confirmed, be removed from it and added to the canonical cache
 *  offline mode updates are intended to use the optimistic cache. Then once we exit offline mode those updates in-spirit (ie it might be merged) will be sent to the server, and then once that's confirmed they will be removed from the optimistic cache and added to the canonical cache
 *
 *  both mode online updates are intended to not be cached persistently and be lost if the connection is lost. However we might want to create an inMemory cache just so we know what updates were successful or not
 *  both mode offline updates are still intended to use the optimistic cache as in regular offline mode
 *
 *
 */
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
