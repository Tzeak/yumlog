#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data/yumlog.db');

console.log('🔄 Yumlog Data Migration');
console.log('========================\n');

if (!fs.existsSync(dbPath)) {
  console.log('❌ Database file not found. No migration needed.');
  process.exit(0);
}

const db = new sqlite3.Database(dbPath);

// Check if migration is needed
db.all("PRAGMA table_info(meals)", (err, columns) => {
  if (err) {
    console.error('Error checking table schema:', err);
    process.exit(1);
  }

  const hasUserIdColumn = columns.some(col => col.name === 'user_id');
  
  if (hasUserIdColumn) {
    console.log('✅ Database already has user_id column. No migration needed.');
    db.close();
    process.exit(0);
  }

  console.log('🔄 Migrating existing data...');
  
  // Create a default user for existing data
  const defaultUserId = 'legacy_user_' + Date.now();
  const defaultPhoneNumber = '+10000000000';
  
  db.run(`
    INSERT INTO users (id, phone_number, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [defaultUserId, defaultPhoneNumber], (err) => {
    if (err) {
      console.error('Error creating default user:', err);
      db.close();
      process.exit(1);
    }
    
    console.log('✅ Created default user for existing data');
    
    // Add user_id column and migrate existing data
    db.run("ALTER TABLE meals ADD COLUMN user_id TEXT", (err) => {
      if (err) {
        console.error('Error adding user_id column:', err);
        db.close();
        process.exit(1);
      }
      
      console.log('✅ Added user_id column');
      
      // Update all existing meals to belong to the default user
      db.run("UPDATE meals SET user_id = ? WHERE user_id IS NULL", [defaultUserId], (err) => {
        if (err) {
          console.error('Error migrating existing meals:', err);
          db.close();
          process.exit(1);
        }
        
        console.log('✅ Migrated existing meals to default user');
        console.log('\n🎉 Migration complete!');
        console.log('\nNote: All existing meals have been assigned to a default user.');
        console.log('Users will need to sign in to access their data going forward.');
        
        db.close();
      });
    });
  });
}); 