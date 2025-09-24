#!/usr/bin/env node

/**
 * Detailed OAuth Debug Script
 * Since all APIs are enabled, let's check other potential issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DETAILED OAUTH DEBUGGING');
console.log('============================\n');

// Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ dist folder not found. Please run the build script first.');
  process.exit(1);
}

console.log('✅ ALL REQUIRED APIs ARE ENABLED:');
console.log('   • Gmail API (gmail.readonly)');
console.log('   • User Info API (userinfo.email)');
console.log('   • Apps Script API (spreadsheets)');
console.log('   • Google Drive API (drive.file)');
console.log('');

// Read manifest.json
const manifestPath = path.join(distPath, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('🔧 CHROME EXTENSION CONFIGURATION:');
  console.log(`   Client ID: ${manifest.oauth2?.client_id}`);
  console.log('   Scopes:');
  manifest.oauth2?.scopes?.forEach(scope => console.log(`     • ${scope}`));
  console.log('');
}

console.log('🔍 POTENTIAL ISSUES TO CHECK:');
console.log('=============================');
console.log('');
console.log('1. 🚨 OAUTH CONSENT SCREEN CONFIGURATION:');
console.log('   - Go to: Google Cloud Console → APIs & Services → OAuth consent screen');
console.log('   - Check "Publishing status":');
console.log('     • If "Testing": Add your email to "Test users" list');
console.log('     • If "Production": Verify all required fields are complete');
console.log('   - Check "Authorized domains":');
console.log('     • Should include: trystamp.ai');
console.log('     • Should include: 70h4jbuv95.execute-api.us-east-2.amazonaws.com');
console.log('');
console.log('2. 🔧 OAUTH CLIENT CONFIGURATION:');
console.log('   - Go to: APIs & Services → Credentials');
console.log('   - Find your Chrome Extension OAuth client:');
console.log('     • Application type: Should be "Chrome app" or "Web application"');
console.log('     • Authorized redirect URIs should include:');
console.log('       - https://trystamp.ai/oauth2-callback');
console.log('       - https://[your-extension-id].chromiumapp.org/');
console.log('   - Verify the client ID matches exactly:');
console.log('     • Manifest: 759225635526-gs69pgupgap87o4ul9ud9pv8pjrupcgc.apps.googleusercontent.com');
console.log('');
console.log('3. 💳 BILLING AND QUOTAS:');
console.log('   - Check if billing is enabled for your project');
console.log('   - Check if there are any quota limits exceeded');
console.log('   - Some APIs require billing even for free tier');
console.log('');
console.log('4. 🔐 PERMISSIONS AND RESTRICTIONS:');
console.log('   - Check if your Google account has any restrictions');
console.log('   - Try with a different Google account to test');
console.log('   - Check if your organization has any OAuth restrictions');
console.log('');
console.log('5. 🧪 TEST WITH MINIMAL SCOPES:');
console.log('   - Try temporarily removing spreadsheets and drive.file scopes');
console.log('   - Test with only gmail.readonly and userinfo.email');
console.log('   - If that works, add scopes back one by one');
console.log('');
console.log('📝 NEXT STEPS:');
console.log('==============');
console.log('1. Check OAuth consent screen configuration (most likely issue)');
console.log('2. Verify client ID and redirect URIs match exactly');
console.log('3. Test with a different Google account');
console.log('4. Check browser console for detailed error messages');
console.log('');
console.log('🔍 TO GET YOUR EXTENSION ID:');
console.log('   - Go to chrome://extensions/');
console.log('   - Find your extension');
console.log('   - Copy the ID (looks like: abcdefghijklmnopqrstuvwxyz123456)');
console.log('   - Use it in redirect URI: https://[extension-id].chromiumapp.org/');
