/*
    
    

*/

import { Update, UpdateOptRow } from "./0-data-model"

// encryption steps
let plaintext: UpdateOptRow[]
let encoded: Uint8Array
let clientSigned: Uint8Array
let padded: Uint8Array
let encrypted: Uint8Array
let serverSigned: Uint8Array

// UpdateOptRow[] -> encrypted&server-signed
// encrypted&server-signed -> Update[]
