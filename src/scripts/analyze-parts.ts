import axios from 'axios';
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const WINDCHILL_URL = process.env.WINDCHILL_URL || 'http://plm.windchill.com/Windchill';
const WINDCHILL_USER = process.env.WINDCHILL_USER || 'wcadmin';
const WINDCHILL_PASSWORD = process.env.WINDCHILL_PASSWORD || 'wcadmin';
const API_BASE = `${WINDCHILL_URL}/servlet/odata`;

// Create axios client with basic auth
const client = (axios as any).create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: WINDCHILL_USER,
    password: WINDCHILL_PASSWORD,
  },
});

interface Part {
  ID: string;
  Number: string;
  Name: string;
  State?: string;
  hasChildren?: boolean;
  isUsedIn?: boolean;
}

interface BOMStructure {
  children?: any[];
  usedIn?: any[];
}

async function getAllParts(): Promise<Part[]> {
  console.log('Fetching all parts from Windchill...');
  try {
    const response = await client.get('/ProdMgmt/Parts', {
      params: {
        '$select': 'ID,Number,Name,State',
        '$top': 1000, // Adjust if you have more parts
      },
    });

    const parts = response.data.value || [];
    console.log(`Found ${parts.length} parts`);
    return parts;
  } catch (error: any) {
    console.error('Error fetching parts:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function getBOMStructure(partId: string): Promise<BOMStructure | null> {
  try {
    const response = await client.get(`/ProdMgmt/Parts('${partId}')/Structure`, {
      params: {
        'levels': 1,
      },
    });
    return response.data;
  } catch (error: any) {
    // Part might not have BOM structure
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`Error fetching BOM for part ${partId}:`, error.message);
    return null;
  }
}

async function getPartUsage(partId: string): Promise<any[]> {
  try {
    const response = await client.get(`/ProdMgmt/Parts('${partId}')/UsedIn`);
    return response.data.value || [];
  } catch (error: any) {
    // Part might not have usage
    if (error.response?.status === 404) {
      return [];
    }
    console.error(`Error fetching usage for part ${partId}:`, error.message);
    return [];
  }
}

async function analyzeParts() {
  console.log('='.repeat(80));
  console.log('Windchill Parts Analysis');
  console.log('='.repeat(80));
  console.log();

  // Get all parts
  const allParts = await getAllParts();
  console.log();

  // Analyze each part to determine if it's an assembly or end item
  console.log('Analyzing part structures...');
  const assemblies: Part[] = [];
  const endItems: Part[] = [];
  const components: Part[] = [];

  let processed = 0;
  for (const part of allParts) {
    processed++;
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${allParts.length} parts analyzed`);
    }

    // Check if part has children (is an assembly)
    const bomStructure = await getBOMStructure(part.ID);
    const hasChildren = bomStructure?.children && bomStructure.children.length > 0;

    // Check if part is used in other assemblies
    const usedIn = await getPartUsage(part.ID);
    const isUsedIn = usedIn.length > 0;

    part.hasChildren = hasChildren;
    part.isUsedIn = isUsedIn;

    if (hasChildren) {
      assemblies.push(part);

      // If assembly is not used in any other assembly, it's an end item
      if (!isUsedIn) {
        endItems.push(part);
      }
    } else if (!isUsedIn) {
      // Parts with no children and not used anywhere could be standalone parts
      components.push(part);
    } else {
      components.push(part);
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('Analysis Results');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total Parts: ${allParts.length}`);
  console.log(`Assemblies (parts with children): ${assemblies.length}`);
  console.log(`End Items (top-level assemblies): ${endItems.length}`);
  console.log(`Components (parts without children): ${components.length}`);
  console.log();

  // Show examples
  if (assemblies.length > 0) {
    console.log('Example Assemblies:');
    assemblies.slice(0, 5).forEach(part => {
      console.log(`  - ${part.Number}: ${part.Name} (ID: ${part.ID})`);
    });
    console.log();
  }

  if (endItems.length > 0) {
    console.log('Example End Items (Top-Level Products):');
    endItems.slice(0, 5).forEach(part => {
      console.log(`  - ${part.Number}: ${part.Name} (ID: ${part.ID})`);
    });
    console.log();
  }

  if (components.length > 0) {
    console.log('Example Components (first 5):');
    components.slice(0, 5).forEach(part => {
      console.log(`  - ${part.Number}: ${part.Name} (ID: ${part.ID})`);
    });
    console.log();

    if (components.length > 5) {
      console.log(`All Components (${components.length} total):`);
      components.forEach(part => {
        const state = part.State ? (typeof part.State === 'object' ? JSON.stringify(part.State) : part.State) : 'N/A';
        console.log(`  - ${part.Number}: ${part.Name} (State: ${state})`);
      });
      console.log();
    }
  }

  // Summary statistics
  console.log('='.repeat(80));
  console.log('Summary Statistics');
  console.log('='.repeat(80));
  console.log();
  console.log(`Assembly Ratio: ${((assemblies.length / allParts.length) * 100).toFixed(1)}%`);
  console.log(`End Item Ratio: ${((endItems.length / allParts.length) * 100).toFixed(1)}%`);
  console.log(`Component Ratio: ${((components.length / allParts.length) * 100).toFixed(1)}%`);
  console.log();

  return {
    totalParts: allParts.length,
    assemblies: assemblies.length,
    endItems: endItems.length,
    components: components.length,
    exampleAssemblies: assemblies.slice(0, 5),
    exampleEndItems: endItems.slice(0, 5),
    exampleComponents: components.slice(0, 5),
  };
}

// Run the analysis
analyzeParts()
  .then(() => {
    console.log('Analysis completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  });