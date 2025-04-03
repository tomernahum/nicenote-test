// functions that provider calls to interact with server
// this adapts those functions into e2ee server calls
// see mock-server-interface.ts, we need to implement the same functions interface

// this project is meant to be an e2ee adapter for yjs - but my overall project, which will use this project, will involve users with multiple documents and read/write/share permissions - so we'll see how this all shakes out
// maybe in here we will include read/write permissions, managed by secret keys that the user has to know (can exist in the url after # or as a separate param to the provider)
// then a separate module for user management which also manages their key

/* 

    old brainstorm:

    like local-provider.ts but with e2ee


    - before pushing, we need to encrypt properly
    - upon receiving, we need to decrypt properly

    we need a secret key to be able to access the document
    I also want a read-only option in my final system. so if the user is read-only, we should throw an error on write attempts or something similar

    sharing the key is not the job of the yjs provider... maybe it will be colocated with the encryption/decryption functions though which is the job of the yjs provider to call
    also we may want some metadata about the document, I guess we could just store it in the yjs doc
    metadata may include who has access to the document, or even important keys and stuff
    so maybe it is tied to yjs, but I guess it's still not tied to the provider, provider doesn't understand significance of updates it's sharing, that's handled by application interacting with yjs

    The other thing though:
    we might want to only send updates every X ms to prevent server gleaning something from how often updates are sent (like how fast someone is typing/formatting/pressing backspace keys)
    we also might want dummy updates... idrk


*/

// Let's start by defining some functions that the local provider will call to interact with the data
// see local-provider.ts for more context
// the same code as local-provider will call these functions from our server-interaction module, which will be in charge of creating limits, encryption, and interacting with the server

type YUpdate = Uint8Array

// these are all for a yDoc specifically
export async function connectToDoc(docId: string) {} // make sure we are connected to server, make sure the doc is initialized
export async function getRemoteDocUpdateList(
    docId: string
): Promise<YUpdate[]> {} // returns a list of yjs updates, can be processed by the provider into a yjs doc
export async function subscribeToRemoteDocUpdates(
    docId: string,
    callback: (update: Uint8Array) => void
) {} // register callback for when a new update is received
export async function broadcastUpdate(docId: string, update: Uint8Array) {}
export async function doSquash(
    docId: string,
    lastSeenUpdateIdentifier: unknown,
    newUpdate: Uint8Array
) {}
// Ephemeral state / (used for yjs awareness updates)
// not really any different at all than yDoc, implemented outside of yDoc by yjs because it's ephemeral

/*
    rooms
        ydoc
        yawareness


*/
