// @ts-nocheck

// comments that were me thinking "out loud" inside other files
// need to move them to back of fridge before deleting them in case I need them (i'm not a good git user)
// some might actually be useful

// -----------

/*
    may be like this or implemented slightly differently:
    
    we will need to detect if an automatic merge is desired in smart-manual mode.
    
    hasServerUpdatedSinceLastOnline() 
    hasMyStateUpdatedSinceLastOnline()
    if neither: you're done
    if just me: merge up
    if just server: merge down  (some users may not want this - can be a different merge strategy)
    if both: (assume they are not equal - then we have conflicting state) enter both mode
    
    how to detect if it's updated? either compare the last update's id, or call the crdt provider to compare the equality of states
    what if it's been updated but only by being snapshotted? maybe the id of the snapshot can remain the same as the last update
    what if it's been updated but to something and back again? subjective whether we should auto merge in this case, but I think we should - so maybe we should detect by comparing equality via the crdt provider
    
    crdtProvider.static.areTheseEqual(serverState[], localState[])
    instance.isAnotherDocEqualToMe(serverState[]) (very similar to getChangesNotAppliedToAnotherDoc)
    
*/

// ---------

async function goOnlineAutomaticStrategyDraft() {
    // // simulate online mode so we don't miss any updates
    // const inMemoryCache = createInMemoryCache()
    // const ephemeralOnlineProvider = createOnlineProvider(
    //     mainLocalCrdtInterface,
    //     inMemoryCache,
    //     server,
    //     "off"
    // )
    // ephemeralOnlineProvider.turn("on")

    /* 
            Steps that need doing:
            - get the remote doc updates
            - apply remote doc updates to the crdt
            ----
            - get the unconfirmed local updates
            - apply unconfirmed local updates to the server
            
            optimization: squash unconfirmed local updates
            optimization: get only the diff of local state vs server state
            (local state)
        
        */

    // --------
    // todo
    // two approaches (?):
    // 1) combine the local cache list and the server list
    // 2) use the local crdt
    // the local crdt is supposed to represent the state of the local cache, so we can just call it to get the state

    /*
        we want to have online mode 
        
        wait can we go into online mode, queue the diff shit to go up (but have it be stayed as optimistic update), and that's it?
        if it succeeds, then yeah. And we can listen for new updates
        if it fails though, we don't have retry failed important updates functionality, so it would be lost (uh oh)
        
        so instead we can fully simulate online mode but only go into real online mode once we know our local state has merged
        
        I mean we don't actually discard failed updates yet afaik. I guess we will only discard updates sent by online mode. but still no retry. I guess if it fails to send we would want to send message to our user "failed to merge update up, would you like to try again? or try to go into both mode, or discard the local state?" or we could just fail the whole ->online mode and communicate the reason it failed afawwk
    */

    // draft code
    // onlineProvider.

    // onlineProvider.sendLessOptimisticUpdate(remoteDocUpdates)
    // onlineProvider.sendLessOptimisticUpdate(remoteDocUpdates)

    // reference code from prev draft:
    let temp: boolean = false
    if (temp) {
        // merge the server state and the local cache state
        // TODO: look over.    Right now it is merging with the crdt holder not the local cache. Which may be fine

        const remoteDocUpdates = await server.getRemoteUpdateList()
        const remoteDocUpdatesWithoutIds = remoteDocUpdates.map((u) => u.update)

        mainLocalCrdtInterface.applyRemoteUpdates(remoteDocUpdatesWithoutIds)

        const diffUpdates =
            mainLocalCrdtInterface.getChangesNotAppliedToAnotherDoc(
                remoteDocUpdatesWithoutIds
            )

        // could also have a static method that doesn't modify our real crdt?

        // Send diff updates to server
        await server.addUpdates(diffUpdates)
        // promise should resolve when server confirms receipt. Or throw if it fails

        // what if an update comes in while we are merging? or user makes an update while we are merging? TODO
        // maybe this logic needs to go in the provider?

        // once merged, transition to online mode
        offlineProvider.turn("off")
        onlineProvider.turn("on")
    }
}

// // maybe:
// async initializeConnectionWithMergeAndTurnOn() {
//     const pendingClientUpdates = (
//         await localCache.getUnconfirmedOptimisticUpdates()
//     ).map((u) => encodeListWithMixedTypes([u.id, u.update]))
//     const serverState = (await server.getRemoteUpdateList()).map(
//         (u) => u.update
//     )
//     // localCRDT should have the pending updates and previous server state already

//     localCRDTInterface.applyRemoteUpdates(serverState)
//     const diffUpdates =
//         localCRDTInterface.getChangesNotAppliedToAnotherDoc(serverState)

//     // todo: merge with server state
//     // todo: transition to online mode
//     // also need to make sure the remoteUpdateSubscriptions and stuff is really on
//     // maybe before we do any of this we need to implement server disconnect notification logic and recconect
// },
