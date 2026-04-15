const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const port = 3000;

// -------------------- INIT -------------------- //

app.use(cors());
app.use(express.json());

const dbPath = path.resolve(__dirname, "../tracker.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
    db.exec(
        `
            CREATE TABLE IF NOT EXISTS nodes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              type TEXT NOT NULL,
              json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS edges (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
              target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
              source_port TEXT,
              target_port TEXT
            );
            `,
          (err) => {
            if (err) {
              console.error("Error creating table:", err.message);
            }
          }
        );
  }
});

//---------- ---------- ---------- ---------- //

app.get("/api/nodes", (req, res) => {
  db.all("SELECT * FROM nodes", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const nodes = rows.map(r => ({
        ...r,
        json: JSON.parse(r.json)
    }));
    res.json(nodes);
  });
});

app.post("/api/nodes", (req, res) => {
    const { type, json } = req.body;
    if (!type || typeof json !== "object") {
        return res.status(400).json({ error: "type and json payload required" });
    }
    const payload = JSON.stringify(json);
    db.run(
        "INSERT INTO nodes (type, json) VALUES (?, ?)",
        [type, payload],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});
