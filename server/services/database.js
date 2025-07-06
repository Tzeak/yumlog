const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbPath =
  process.env.DB_PATH || path.join(__dirname, "../../data/yumlog.db");

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err);
        reject(err);
        return;
      }

      console.log("📊 Connected to SQLite database");

      // Create users table if it doesn't exist
      const createUsersTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          phone_number TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      db.run(createUsersTableQuery, (err) => {
        if (err) {
          console.error("Error creating users table:", err);
          reject(err);
          return;
        }

        console.log("✅ Users table ready");

        // Create meals table if it doesn't exist
        const createMealsTableQuery = `
          CREATE TABLE IF NOT EXISTS meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            image_path TEXT,
            analysis TEXT NOT NULL,
            note TEXT,
            timestamp TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `;

        db.run(createMealsTableQuery, (err) => {
          if (err) {
            console.error("Error creating meals table:", err);
            reject(err);
            return;
          }

          console.log("✅ Meals table ready");

          // Check if user_id column exists in meals table (migration)
          db.all("PRAGMA table_info(meals)", (err, columns) => {
            if (err) {
              console.error("Error getting table info:", err);
              reject(err);
              return;
            }

            const hasUserIdColumn = columns.some(
              (col) => col.name === "user_id"
            );
            const hasNoteColumn = columns.some((col) => col.name === "note");

            if (!hasUserIdColumn) {
              console.log("🔄 Adding user_id column to meals table...");
              db.run("ALTER TABLE meals ADD COLUMN user_id TEXT", (err) => {
                if (err) {
                  console.error("Error adding user_id column:", err);
                  reject(err);
                  return;
                }
                console.log("✅ User ID column added successfully");

                // Add note column if it doesn't exist
                if (!hasNoteColumn) {
                  console.log("🔄 Adding note column to meals table...");
                  db.run("ALTER TABLE meals ADD COLUMN note TEXT", (err) => {
                    if (err) {
                      console.error("Error adding note column:", err);
                      reject(err);
                      return;
                    }
                    console.log("✅ Note column added successfully");
                    resolve();
                  });
                } else {
                  console.log("✅ Note column already exists");
                  resolve();
                }
              });
            } else if (!hasNoteColumn) {
              console.log("🔄 Adding note column to meals table...");
              db.run("ALTER TABLE meals ADD COLUMN note TEXT", (err) => {
                if (err) {
                  console.error("Error adding note column:", err);
                  reject(err);
                  return;
                }
                console.log("✅ Note column added successfully");
                resolve();
              });
            } else {
              console.log("✅ All columns already exist");
              resolve();
            }
          });
        });
      });
    });
  });
}

function createOrUpdateUser(userId, phoneNumber) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT OR REPLACE INTO users (id, phone_number, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;

    db.run(query, [userId, phoneNumber], function (err) {
      if (err) {
        console.error("Error creating/updating user:", err);
        reject(err);
        return;
      }

      resolve(this.lastID);
    });
  });
}

function getUserById(userId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM users WHERE id = ?";

    db.get(query, [userId], (err, row) => {
      if (err) {
        console.error("Error fetching user:", err);
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function saveMeal(mealData) {
  return new Promise((resolve, reject) => {
    const { userId, imagePath, analysis, note, timestamp } = mealData;
    const analysisJson = JSON.stringify(analysis);

    const query = `
      INSERT INTO meals (user_id, image_path, analysis, note, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(
      query,
      [userId, imagePath || null, analysisJson, note || null, timestamp],
      function (err) {
        if (err) {
          console.error("Error saving meal:", err);
          reject(err);
          return;
        }

        resolve(this.lastID);
      }
    );
  });
}

function getMeals(userId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT id, image_path, analysis, note, timestamp, created_at
      FROM meals
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error("Error fetching meals:", err);
        reject(err);
        return;
      }

      // Parse the analysis JSON for each meal
      const meals = rows.map((row) => ({
        id: row.id,
        imagePath: row.image_path,
        analysis: JSON.parse(row.analysis),
        note: row.note,
        timestamp: row.timestamp,
        createdAt: row.created_at,
      }));

      resolve(meals);
    });
  });
}

function deleteMeal(mealId, userId) {
  return new Promise((resolve, reject) => {
    // First get the image path to delete the file
    const getQuery =
      "SELECT image_path FROM meals WHERE id = ? AND user_id = ?";

    db.get(getQuery, [mealId, userId], (err, row) => {
      if (err) {
        console.error("Error fetching meal for deletion:", err);
        reject(err);
        return;
      }

      if (!row) {
        reject(new Error("Meal not found or unauthorized"));
        return;
      }

      // Delete the image file
      const imagePath = path.join(__dirname, "../../uploads", row.image_path);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Delete from database
      const deleteQuery = "DELETE FROM meals WHERE id = ? AND user_id = ?";
      db.run(deleteQuery, [mealId, userId], (err) => {
        if (err) {
          console.error("Error deleting meal:", err);
          reject(err);
          return;
        }

        resolve();
      });
    });
  });
}

function getDailyStats(date, userId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT analysis
      FROM meals
      WHERE DATE(created_at) = DATE(?) AND user_id = ?
    `;

    db.all(query, [date, userId], (err, rows) => {
      if (err) {
        console.error("Error fetching daily stats:", err);
        reject(err);
        return;
      }

      const stats = {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        totalSugar: 0,
        mealCount: rows.length,
      };

      rows.forEach((row) => {
        const analysis = JSON.parse(row.analysis);
        stats.totalCalories += analysis.total_calories || 0;
        stats.totalProtein += analysis.total_protein || 0;
        stats.totalCarbs += analysis.total_carbs || 0;
        stats.totalFat += analysis.total_fat || 0;
        stats.totalFiber += analysis.total_fiber || 0;
        stats.totalSugar += analysis.total_sugar || 0;
      });

      resolve(stats);
    });
  });
}

module.exports = {
  initDatabase,
  createOrUpdateUser,
  getUserById,
  saveMeal,
  getMeals,
  deleteMeal,
  getDailyStats,
};
