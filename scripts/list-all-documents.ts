#!/usr/bin/env tsx
/**
 * Script to retrieve all documents from Windchill and display their number, name, and filename
 *
 * Usage: npm run dev scripts/list-all-documents.ts
 */

import dotenv from 'dotenv';
import { WindchillAPIService } from '../src/services/windchill-api.js';
import { apiEndpoints } from '../src/config/windchill.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from docker/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', 'docker', '.env');
dotenv.config({ path: envPath });

interface Document {
  ID?: string;
  Number?: string;
  Name?: string;
  FileName?: string;
  Type?: string;
  State?: string;
  Version?: string;
  CreatedOn?: string;
  ModifiedOn?: string;
  CreatedBy?: string;
}

async function getAllDocuments() {
  console.log('\n=== Windchill Document List ===\n');
  console.log(`Connecting to: ${process.env.WINDCHILL_URL}`);
  console.log(`User: ${process.env.WINDCHILL_USER}\n`);

  try {
    // Initialize the API service
    const api = new WindchillAPIService();

    // Query for all documents with selected fields
    console.log('Fetching documents from Windchill...\n');

    const response = await api.get(
      `${apiEndpoints.documents}?$select=ID,Number,Name,FileName,Type,State,Version,CreatedOn,ModifiedOn,CreatedBy&$top=1000`
    );

    const documents: Document[] = response.data.value || [];

    console.log(`Found ${documents.length} document(s)\n`);
    console.log('─'.repeat(120));
    console.log(
      'Document Number'.padEnd(25) +
      'Document Name'.padEnd(45) +
      'File Name'.padEnd(35) +
      'Type'.padEnd(15)
    );
    console.log('─'.repeat(120));

    if (documents.length === 0) {
      console.log('No documents found in the system.');
    } else {
      documents.forEach((doc) => {
        const number = (doc.Number || 'N/A').padEnd(25);
        const name = (doc.Name || 'N/A').padEnd(45).substring(0, 45);
        const fileName = (doc.FileName || 'N/A').padEnd(35).substring(0, 35);
        const type = (doc.Type || 'N/A').padEnd(15);

        console.log(`${number}${name}${fileName}${type}`);
      });
    }

    console.log('─'.repeat(120));
    console.log(`\nTotal: ${documents.length} document(s)\n`);

    // Also create a JSON output for programmatic use
    const jsonOutput = documents.map(doc => ({
      documentNumber: doc.Number || 'N/A',
      documentName: doc.Name || 'N/A',
      fileName: doc.FileName || 'N/A',
      type: doc.Type || 'N/A',
      id: doc.ID || 'N/A',
      state: doc.State || 'N/A',
      version: doc.Version || 'N/A'
    }));

    const fs = await import('fs');
    const outputPath = path.join(__dirname, 'documents-list.json');
    fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`\nJSON output saved to: ${outputPath}\n`);

    return jsonOutput;

  } catch (error: any) {
    console.error('\n❌ Error fetching documents:');
    console.error(`Message: ${error.message}`);

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error(`Response Data:`, error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Request:', error.request);
    }

    console.error('\nPlease check:');
    console.error('1. Windchill server is accessible at:', process.env.WINDCHILL_URL);
    console.error('2. Credentials are correct (user:', process.env.WINDCHILL_USER + ')');
    console.error('3. Network connectivity to Windchill server\n');

    process.exit(1);
  }
}

// Run the script
getAllDocuments();