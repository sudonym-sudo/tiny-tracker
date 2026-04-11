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
    db.run(
      `
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
      (err) => {
        if (err) {
          console.error("Error creating table:", err.message);
        }
      },
    );
  }
});

//---------- ---------- ---------- ---------- //

app.get("/api/expenses", (req, res) => {
  db.all("SELECT * FROM expenses", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post("/api/expenses", (req, res) => {
  const { description, amount } = req.body;
  console.log("Received POST request:", req.body);
  db.run(
    "INSERT INTO expenses (description, amount) VALUES (?, ?)",
    [description, amount],
    function (err) {
      if (err) {
        console.error("SQLite insert error:", err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, description, amount });
    },
  );
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});
