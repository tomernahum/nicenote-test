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
/*
    Problem:
    we want to have a local cache that can be backed by a user-interactable .md/.docx/.opml/etc file on filesystem
        this should contain the optimistic state
    but having a separate canonical vs optimistic updates list section makes this difficult

    we may be able to solve this using the current api, or we may need to rewrite provider-with-storage entirely to fix this, for now I want to get some kind of working version done to learn how it may be possible.

    ---

    could keep track of whether a update rejected in memory   + keep optimistic full state cache
    on optimistic update, commit it to the local cache
    if we get cut off, that will be in the diff to merge up
        if merge up gets rejected: todo (same with our current system)
    if update got rejected, roll it back from the local cache (how?)

    ---

    maybe updates never get rejected, only confirmed or never confirmed
    if an update hasn't been confirmed yet, it stays in the optimistic cache forever and is retried next time we go online
    no updates from a valid write-permissioned user are considered invalid.... maybe
        still could have user identity tied to the update when it's received from server and modified before applying to local crdt
        though rn only way to update to the server is through the local crdt and then unmodified sent to server

    ok if updates don't get rejected:
    There is one local cache with all optimistic and canonical updates represented
    optimistic updates are added to the local cache, same with received canonical updates
    received canonical updates that are duplicates of optimistic updates are redundant when being added to the local cache

    merging in to the file-based cache is done like this
    fileState(  crdtState(fileState).applyUpdate()  )
    hopefully that is consistent?

*/
