#!/usr/bin/env node

/**
 * Deployment Test Script
 * Tests the Angular UI deployment configuration without requiring Docker
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Angular UI Deployment Configuration...\n');

// Test 1: Check if Angular files exist
console.log('1. Checking Angular application files...');
const requiredFiles = [
  'angular-ui/src/main.ts',
  'angular-ui/src/index.html',
  'angular-ui/src/app/app.component.ts',
  'angular-ui/src/app/services/mcp.service.ts',
  'angular-ui/src/app/models/tool.model.ts',
  'angular-ui/package.json',
  'angular-ui/angular.json',
  'angular-ui/tsconfig.json'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file}`);
    allFilesExist = false;
  }
});

// Test 2: Check Docker configuration
console.log('\n2. Checking Docker configuration...');
const dockerFiles = [
  'docker/Dockerfile.ui',
  'docker/nginx.conf',
  'docker/deploy-ui.sh'
];

dockerFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file}`);
    allFilesExist = false;
  }
});

// Test 3: Validate package.json scripts
console.log('\n3. Checking npm scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredScripts = ['ui:install', 'ui:build', 'ui:serve', 'deploy:ui', 'deploy:all'];

requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(`   ✅ ${script}: ${packageJson.scripts[script]}`);
  } else {
    console.log(`   ❌ ${script}: Not found`);
    allFilesExist = false;
  }
});

// Test 4: Check docker-compose configuration
console.log('\n4. Checking Docker Compose configuration...');
const dockerCompose = fs.readFileSync('docker/docker-compose.yml', 'utf8');

if (dockerCompose.includes('windchill-mcp-ui:')) {
  console.log('   ✅ UI service defined in docker-compose.yml');
} else {
  console.log('   ❌ UI service not found in docker-compose.yml');
  allFilesExist = false;
}

if (dockerCompose.includes('4200:8080')) {
  console.log('   ✅ Port mapping configured (4200:8080)');
} else {
  console.log('   ❌ Port mapping not configured correctly');
  allFilesExist = false;
}

// Test 5: Validate nginx configuration
console.log('\n5. Checking nginx configuration...');
const nginxConf = fs.readFileSync('docker/nginx.conf', 'utf8');

if (nginxConf.includes('proxy_pass http://windchill-mcp-server:3000/')) {
  console.log('   ✅ API proxy configured correctly');
} else {
  console.log('   ❌ API proxy not configured correctly');
  allFilesExist = false;
}

if (nginxConf.includes('try_files $uri $uri/ /index.html')) {
  console.log('   ✅ Angular routing support enabled');
} else {
  console.log('   ❌ Angular routing support missing');
  allFilesExist = false;
}

// Summary
console.log('\n📊 Deployment Test Summary:');
if (allFilesExist) {
  console.log('🎉 All tests passed! The Angular UI is ready for deployment.');
  console.log('\n🚀 To deploy with Docker:');
  console.log('   1. npm run deploy:all    # Deploy complete system');
  console.log('   2. npm run deploy:ui     # Deploy UI only');
  console.log('\n🌐 Access points:');
  console.log('   • Angular UI: http://localhost:4200');
  console.log('   • MCP API:    http://localhost:3000/api/');
  console.log('   • Server:     http://localhost:3000');
} else {
  console.log('ℹ️  Note: Angular Dockerfile uses npm install (generates package-lock.json during build)');
  console.log('ℹ️  Note: Angular configuration cleaned (removed environment files and Angular Material dependencies)');
  console.log('ℹ️  Note: Fixed HTML template syntax issues and polyfills configuration');
  console.log('ℹ️  Note: Simplified polyfills.ts (removed @angular/localize/init and fixed zone.js import)');
  console.log('ℹ️  Note: Fixed nginx configuration (removed invalid must-revalidate from gzip_proxied)');
  console.log('ℹ️  Note: Added debounced search and safe JSON display to prevent UI freezing');
  console.log('ℹ️  Note: Fixed TypeScript issues (NodeJS.Timeout, HttpClient response types)');
  console.log('ℹ️  Note: Updated Angular dependencies to v18 and suppressed npm deprecation warnings');
  console.log('❌ Some tests failed. Please check the errors above.');
  process.exit(1);
}

console.log('\n✅ Deployment configuration test completed successfully!');