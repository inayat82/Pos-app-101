#!/usr/bin/env node

/**
 * Vercel Environment Variables Setup Script
 * 
 * This script helps configure the required environment variables for the POS app
 * to work properly with Firebase and Takealot API integration.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 VERCEL ENVIRONMENT VARIABLES SETUP');
console.log('=====================================\n');

// Read the Firebase service account file
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ firebase-service-account.json not found!');
  console.log('Expected at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Create the environment variables
const environmentVariables = {
  'GOOGLE_APPLICATION_CREDENTIALS_JSON': JSON.stringify(serviceAccount),
  'FIREBASE_SERVICE_ACCOUNT_PROJECT_ID': serviceAccount.project_id,
  'FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY': serviceAccount.private_key,
  'FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL': serviceAccount.client_email,
  'CRON_SECRET': generateRandomSecret(),
  'TAKEALOT_API_KEY': 'YOUR_ACTUAL_TAKEALOT_API_KEY_HERE'
};

console.log('📋 Required Environment Variables:');
console.log('==================================\n');

Object.entries(environmentVariables).forEach(([key, value]) => {
  console.log(`${key}:`);
  if (key === 'GOOGLE_APPLICATION_CREDENTIALS_JSON') {
    console.log(`${value.substring(0, 50)}...`);
  } else if (key === 'FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY') {
    console.log('-----BEGIN PRIVATE KEY-----...');
  } else {
    console.log(value);
  }
  console.log('');
});

console.log('🚀 VERCEL DEPLOYMENT COMMANDS:');
console.log('==============================\n');

console.log('Run these commands to set environment variables:\n');

Object.entries(environmentVariables).forEach(([key, value]) => {
  // Escape quotes and newlines for command line
  const escapedValue = value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  console.log(`vercel env add ${key} production`);
  console.log(`# When prompted, enter: ${key === 'GOOGLE_APPLICATION_CREDENTIALS_JSON' ? '[PASTE_FULL_JSON]' : key === 'FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY' ? '[PASTE_PRIVATE_KEY]' : escapedValue}`);
  console.log('');
});

console.log('📝 ALTERNATIVE: Use Vercel Dashboard');
console.log('===================================\n');
console.log('1. Go to: https://vercel.com/dashboard');
console.log('2. Select your pos-app project');
console.log('3. Go to Settings > Environment Variables');
console.log('4. Add each variable listed above');
console.log('');

console.log('⚠️  IMPORTANT NOTES:');
console.log('===================');
console.log('1. Replace YOUR_ACTUAL_TAKEALOT_API_KEY_HERE with your real API key');
console.log('2. After adding variables, redeploy the app: vercel --prod');
console.log('3. All API endpoints will work after environment variables are set');
console.log('');

// Save to a file for easy reference
const envFileContent = Object.entries(environmentVariables)
  .map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`)
  .join('\n');

fs.writeFileSync(path.join(__dirname, '..', '.env.example'), envFileContent);
console.log('💾 Environment variables saved to .env.example for reference');

console.log('\n✅ Setup complete! Configure these variables in Vercel dashboard.');

function generateRandomSecret() {
  return require('crypto').randomBytes(32).toString('hex');
}
