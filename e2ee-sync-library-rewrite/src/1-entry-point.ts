type LocalUpdate = Uint8Array
interface LocalProvider {
    subscribeToLocalUpdates: (update: LocalUpdate) => void
    applyRemoteUpdate: (update: LocalUpdate) => void
}
;``
