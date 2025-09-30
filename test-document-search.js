import { DocumentAgent } from './dist/agents/document-agent.js';

async function testDocumentSearch() {
  console.log('🔍 Testing document search for number "000*"...');

  try {
    // Create a new document agent instance
    const documentAgent = new DocumentAgent();

    // Find the search tool
    const searchTool = documentAgent.tools.find(tool => tool.name === 'search');

    if (!searchTool) {
      throw new Error('Search tool not found in document agent');
    }

    console.log('📋 Tool found:', searchTool.name);
    console.log('📝 Description:', searchTool.description);

    // Call the search handler with the number '000*'
    console.log('\n🚀 Calling document_search with number: "000*"');

    const result = await searchTool.handler.call(documentAgent, {
      number: '0000000005'
    });

    console.log('\n✅ Search completed successfully!');
    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));

    // Show summary
    if (result.value && Array.isArray(result.value)) {
      console.log(`\n📈 Found ${result.value.length} documents matching "000*"`);

      result.value.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.Number || 'N/A'} - ${doc.Name || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error occurred:');
    console.error('Message:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }

    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testDocumentSearch().catch(console.error);
