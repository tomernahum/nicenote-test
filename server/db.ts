import Database from "better-sqlite3";

const db = new Database("./storage/dev-db.db");

db.prepare(`
    CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        doc_id TEXT NOT NULL,
        all_doc_ids TEXT

        action_data TEXT NOT NULL,
        encryption_scheme_version TEXT NOT NULL


        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    )
`).run();
db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_actions_doc_id ON actions(doc_id)
`).run()


export { db }