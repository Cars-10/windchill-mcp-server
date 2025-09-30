// Simple Node.js script to test the browser behavior
const http = require('http');

// Test that the Angular app is accessible
function testAngularApp() {
  const options = {
    hostname: 'localhost',
    port: 4201,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`Angular App Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (data.includes('<app-root>')) {
        console.log('✓ Angular app is running and serving correctly');
      } else {
        console.log('✗ Angular app response is not correct');
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Angular App Error: ${e.message}`);
  });

  req.end();
}

// Test that the MCP server tools endpoint is accessible
function testMCPServer() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/tools',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`MCP Server Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const tools = JSON.parse(data);
        if (tools.tools && Array.isArray(tools.tools)) {
          const documentTools = tools.tools.filter(t => t.name.startsWith('document_'));
          console.log(`✓ MCP server is running with ${tools.tools.length} total tools`);
          console.log(`✓ Found ${documentTools.length} document tools:`, documentTools.map(t => t.name));
        } else {
          console.log('✗ MCP server response structure is incorrect');
        }
      } catch (e) {
        console.log('✗ MCP server response is not valid JSON');
      }
    });
  });

  req.on('error', (e) => {
    console.error(`MCP Server Error: ${e.message}`);
  });

  req.end();
}

console.log('Testing browser accessibility...\n');
testAngularApp();
testMCPServer();