import express from 'express';
import { DocumentAgent } from './dist/agents/document-agent.js';

const app = express();
app.use(express.json());

// Enable CORS for browser access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

const documentAgent = new DocumentAgent();

// Test endpoint for get_attributes
app.post('/api/document/get_attributes', async (req, res) => {
  try {
    const { objectId, expand } = req.body;

    if (!objectId) {
      return res.status(400).json({ error: 'objectId is required' });
    }

    console.log(`Browser request: get_attributes for ${objectId}`);

    const getAttributesTool = documentAgent.tools.find(tool => tool.name === 'get_attributes');
    const result = await getAttributesTool.handler.call(documentAgent, { objectId, expand });

    res.json({
      success: true,
      data: result,
      objectId: objectId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      status: error.response?.status
    });
  }
});

// Test endpoint for document search
app.get('/api/document/search', async (req, res) => {
  try {
    console.log('Browser request: document search');

    const searchTool = documentAgent.tools.find(tool => tool.name === 'search');
    const result = await searchTool.handler.call(documentAgent, {});

    res.json({
      success: true,
      data: result,
      count: result.value?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      status: error.response?.status
    });
  }
});

// Serve a test HTML page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Windchill MCP Server Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .form-group { margin: 10px 0; }
        input, button { padding: 8px; margin: 5px; }
        input[type="text"] { width: 300px; }
        button { background: #007cba; color: white; border: none; cursor: pointer; }
        button:hover { background: #005a87; }
        .result { background: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin-top: 20px; white-space: pre-wrap; }
        .error { background: #ffe6e6; border-color: #ff0000; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Windchill MCP Server Test Interface</h1>

        <h2>Test get_attributes Method</h2>
        <div class="form-group">
            <input type="text" id="objectId" placeholder="Enter ObjectID (e.g., VR:wt.doc.WTDocument:200027)"
                   value="VR:wt.doc.WTDocument:200027">
            <button onclick="testGetAttributes()">Get Document Attributes</button>
        </div>

        <h2>Test Document Search</h2>
        <div class="form-group">
            <button onclick="testDocumentSearch()">List All Documents</button>
        </div>

        <div id="result" class="result" style="display:none;"></div>
    </div>

    <script>
        async function testGetAttributes() {
            const objectId = document.getElementById('objectId').value;
            const resultDiv = document.getElementById('result');

            if (!objectId) {
                alert('Please enter an ObjectID');
                return;
            }

            try {
                resultDiv.style.display = 'block';
                resultDiv.className = 'result';
                resultDiv.textContent = 'Loading...';

                const response = await fetch('/api/document/get_attributes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ objectId })
                });

                const result = await response.json();
                resultDiv.textContent = JSON.stringify(result, null, 2);

                if (!result.success) {
                    resultDiv.className = 'result error';
                }
            } catch (error) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'result error';
                resultDiv.textContent = 'Error: ' + error.message;
            }
        }

        async function testDocumentSearch() {
            const resultDiv = document.getElementById('result');

            try {
                resultDiv.style.display = 'block';
                resultDiv.className = 'result';
                resultDiv.textContent = 'Loading...';

                const response = await fetch('/api/document/search');
                const result = await response.json();
                resultDiv.textContent = JSON.stringify(result, null, 2);

                if (!result.success) {
                    resultDiv.className = 'result error';
                }
            } catch (error) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'result error';
                resultDiv.textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
  `);
});

const port = 3003;
app.listen(port, () => {
  console.log(`🌐 Browser test server running at http://localhost:${port}`);
  console.log(`📋 Test the get_attributes method directly from your browser!`);
});