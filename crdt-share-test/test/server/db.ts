import dotenv from "dotenv"
import Database from "better-sqlite3"

dotenv.config({ path: ".env.local.public" })

const dbFilePath = process.env.DB_FILE_PATH
if (!dbFilePath) {
    throw new Error("DB_FILE_PATH env var not set")
}
console.log(dbFilePath)

const db = new Database(dbFilePath)

db.exec(
    `CREATE TABLE IF NOT EXISTS doc_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id TEXT NOT NULL,
        operation BLOB NOT NULL,
        added_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`
)
db.exec(
    `CREATE INDEX IF NOT EXISTS idx_doc_operations_doc_id ON doc_operations (doc_id)`
)

export function addDocOperation(docId: string, operation: Uint8Array) {
    const insert = db.prepare(
        `INSERT INTO doc_operations (doc_id, operation) VALUES (?, ?)`
    )
    const x = insert.run(docId, operation)
    return x.lastInsertRowid
    console.log("added", x)
}

export function getAllDocOperations(docId: string) {
    const select = db.prepare(
        `SELECT id, operation FROM doc_operations WHERE doc_id = ?`
    )
    return select.all(docId) as { id: number; operation: Uint8Array }[]
}
