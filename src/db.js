const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "nutrition.db");

function ensureDataFolder() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function createDatabase() {
  ensureDataFolder();
  const db = new sqlite3.Database(dbPath, (error) => {
    if (error) {
      console.error("Error abriendo la base de datos SQLite:", error.message);
      return;
    }
  });

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS food_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT,
        calories REAL NOT NULL,
        original_name TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS weight_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        weight_kg REAL NOT NULL
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        height_cm REAL,
        age_years INTEGER,
        updated_at TEXT
      );
    `);
  });

  return db;
}

const db = createDatabase();

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function addFoodEntry({ date, name, quantity, calories, unit = "unidad", originalName = "" }) {
  const createdAt = new Date().toISOString();
  await runAsync(
    `INSERT INTO food_entries (date, created_at, name, quantity, unit, calories, original_name) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [date, createdAt, name, quantity, unit, calories, originalName],
  );
  return { date, name, quantity, calories, unit, originalName };
}

async function getFoodEntriesByDate(date) {
  return allAsync(
    `SELECT id, date, created_at, name, quantity, unit, calories, original_name FROM food_entries WHERE date = ? ORDER BY created_at ASC;`,
    [date],
  );
}

async function getFoodSummaryByDate(date) {
  const result = await getAsync(
    `SELECT COUNT(*) as items, IFNULL(SUM(calories), 0) as total_calories FROM food_entries WHERE date = ?;`,
    [date],
  );

  return {
    itemCount: result?.items || 0,
    totalCalories: result?.total_calories || 0,
    entries: await getFoodEntriesByDate(date),
  };
}

async function getCaloriesLastNDays(days) {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const startKey = start.toISOString().slice(0, 10);

  const rows = await allAsync(
    `SELECT date, IFNULL(SUM(calories), 0) as total_calories FROM food_entries WHERE date >= ? GROUP BY date ORDER BY date ASC;`,
    [startKey],
  );

  const totalsByDate = rows.reduce((acc, row) => {
    acc[row.date] = row.total_calories;
    return acc;
  }, {});

  return Array.from({ length: days }, (_, index) => {
    const current = new Date();
    current.setDate(current.getDate() - (days - 1 - index));
    const dateKey = current.toISOString().slice(0, 10);
    return {
      date: dateKey,
      total_calories: totalsByDate[dateKey] || 0,
    };
  });
}

async function addWeightEntry(weightKg, date) {
  const createdAt = new Date().toISOString();
  await runAsync(
    `INSERT INTO weight_entries (date, created_at, weight_kg) VALUES (?, ?, ?);`,
    [date, createdAt, weightKg],
  );
  return { date, createdAt, weight_kg: weightKg };
}

async function getRecentWeightEntries(limit = 10) {
  return allAsync(
    `SELECT id, date, created_at, weight_kg FROM weight_entries ORDER BY created_at DESC LIMIT ?;`,
    [limit],
  );
}

async function getLatestWeightEntry() {
  return getAsync(
    `SELECT id, date, created_at, weight_kg FROM weight_entries ORDER BY created_at DESC LIMIT 1;`,
    [],
  );
}

async function getUserProfile() {
  const row = await getAsync(
    `SELECT id, height_cm, age_years, updated_at FROM user_profile WHERE id = 1;`,
    [],
  );
  return row || { id: 1, height_cm: null, age_years: null, updated_at: null };
}

async function saveUserProfile({ height_cm = null, age_years = null }) {
  const existing = await getUserProfile();
  const updatedAt = new Date().toISOString();

  await runAsync(
    `INSERT OR REPLACE INTO user_profile (id, height_cm, age_years, updated_at) VALUES (1, ?, ?, ?);`,
    [height_cm ?? existing.height_cm, age_years ?? existing.age_years, updatedAt],
  );

  return getUserProfile();
}

module.exports = {
  addFoodEntry,
  getFoodSummaryByDate,
  getCaloriesLastNDays,
  addWeightEntry,
  getRecentWeightEntries,
  getLatestWeightEntry,
  getUserProfile,
  saveUserProfile,
};
