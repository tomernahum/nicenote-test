
/*
    Main Functions
    - doAction
    - getDocState
        - subscribeToDocState
*/

type DocId = string


// TODO maybe: field that proves authorization to write to those docs
function doAction(actionData:string, toDocs:DocId[]){
    // commit the actionData to each doc
    // notify any subscribers to that doc of the new action
}

function getDocsUncompressed(docs:DocId[]){
    
}