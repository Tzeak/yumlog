#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🍽️  Yumlog Authentication Setup');
console.log('================================\n');

console.log('This script will help you set up Clerk.dev authentication for Yumlog.\n');

console.log('Steps to get your Clerk publishable key:');
console.log('1. Go to https://clerk.dev and create an account');
console.log('2. Create a new application');
console.log('3. Enable phone number authentication');
console.log('4. Copy your publishable key from the dashboard\n');

rl.question('Enter your Clerk publishable key (starts with pk_test_ or pk_live_): ', (clerkKey) => {
  if (!clerkKey.startsWith('pk_')) {
    console.log('❌ Invalid Clerk key format. Key should start with pk_test_ or pk_live_');
    rl.close();
    return;
  }

  // Update .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Check if Clerk keys already exist
  if (envContent.includes('VITE_CLERK_PUBLISHABLE_KEY=')) {
    envContent = envContent.replace(
      /VITE_CLERK_PUBLISHABLE_KEY=.*/g,
      `VITE_CLERK_PUBLISHABLE_KEY=${clerkKey}`
    );
  } else {
    envContent += `\nVITE_CLERK_PUBLISHABLE_KEY=${clerkKey}`;
  }

  if (envContent.includes('REACT_APP_CLERK_PUBLISHABLE_KEY=')) {
    envContent = envContent.replace(
      /REACT_APP_CLERK_PUBLISHABLE_KEY=.*/g,
      `REACT_APP_CLERK_PUBLISHABLE_KEY=${clerkKey}`
    );
  } else {
    envContent += `\nREACT_APP_CLERK_PUBLISHABLE_KEY=${clerkKey}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Clerk key added to .env file');

  // Create client .env file
  const clientEnvPath = path.join(__dirname, 'client', '.env');
  const clientEnvContent = `REACT_APP_CLERK_PUBLISHABLE_KEY=${clerkKey}`;
  fs.writeFileSync(clientEnvPath, clientEnvContent);
  console.log('✅ Clerk key added to client/.env file');

  console.log('\n🎉 Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Make sure you have an OpenAI API key in your .env file');
  console.log('2. Run "npm run dev" to start the server');
  console.log('3. Run "npm run client" to start the React app');
  console.log('4. Open http://localhost:3000 and sign in with your phone number');

  rl.close();
}); 