#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🍽️ Yumlog Setup');
console.log('==========================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  const envExample = fs.readFileSync(path.join(__dirname, 'env.example'), 'utf8');
  fs.writeFileSync(envPath, envExample);
  console.log('✅ .env file created from template');
  console.log('⚠️  Please edit .env file and add your OpenAI API key\n');
} else {
  console.log('✅ .env file already exists');
}

// Create necessary directories
const dirs = ['data', 'uploads'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created ${dir} directory`);
  }
});

// Check if dependencies are installed
console.log('\n📦 Checking dependencies...');

try {
  // Check server dependencies
  const serverPackageJson = path.join(__dirname, 'package.json');
  if (fs.existsSync(serverPackageJson)) {
    console.log('✅ Server package.json found');
  } else {
    console.log('❌ Server package.json not found');
    process.exit(1);
  }

  // Check client dependencies
  const clientPackageJson = path.join(__dirname, 'client', 'package.json');
  if (fs.existsSync(clientPackageJson)) {
    console.log('✅ Client package.json found');
  } else {
    console.log('❌ Client package.json not found');
    process.exit(1);
  }

  console.log('\n🚀 Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Edit .env file and add your OpenAI API key');
  console.log('2. Run: npm install');
  console.log('3. Run: cd client && npm install');
  console.log('4. Run: npm run dev (for backend)');
  console.log('5. Run: npm run client (for frontend)');
  console.log('\n🌐 Open http://localhost:3000 in your browser');

} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
} 