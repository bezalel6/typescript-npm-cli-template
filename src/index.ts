import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';
import chalk from 'chalk';

interface ImportInfo {
  filePath: string;
  imports: string[];
}

interface AnalyzeOptions {
  glob: string;
  language: 'ts' | 'js';
  output?: string;
}
// Add these interfaces to your code
interface Node {
  id: string;
  imports: string[];
}

interface Graph {
  nodes: Map<string, Node>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

// Update the analyzeFiles function to build a graph
export async function analyzeFiles(options: AnalyzeOptions): Promise<void> {
  try {
    const files = await glob(options.glob);
    
    if (files.length === 0) {
      console.log(chalk.yellow(`No files found matching pattern: ${options.glob}`));
      return;
    }
    
    console.log(chalk.blue(`Found ${files.length} files to analyze...`));
    
    // Initialize the graph
    const graph: Graph = {
      nodes: new Map(),
      edges: []
    };
    
    // Process each file
    for (const filePath of files) {
      try {
        // Extract imports
        const imports = extractImports(filePath);
        
        // Add node to graph
        graph.nodes.set(filePath, {
          id: filePath,
          imports: imports
        });
        
        console.log(chalk.green(`✓ Processed ${filePath}`));
        console.log(`  Imports: ${imports.length > 0 ? imports.join(', ') : 'none'}`);
      } catch (error) {
        console.error(chalk.red(`Error processing ${filePath}:`), error);
      }
    }
    
    // Resolve import paths and build edges
    buildGraphEdges(graph, options);
    
    // Output the graph
    if (options.output) {
      fs.writeFileSync(
        options.output,
        JSON.stringify(graphToJson(graph), null, 2)
      );
      console.log(chalk.blue(`Graph written to ${options.output}`));
    }
    
    // Print summary
    printGraphSummary(graph);
    
  } catch (error) {
    console.error(chalk.red('Error during analysis:'), error);
  }
}

// Function to build graph edges
function buildGraphEdges(graph: Graph, options: AnalyzeOptions): void {
  for (const [filePath, node] of graph.nodes.entries()) {
    const dir = path.dirname(filePath);
    
    for (const importPath of node.imports) {
      // Resolve the import path to an absolute path
      let resolvedPath = path.resolve(dir, importPath);
      
      // Handle extensions
      if (!path.extname(resolvedPath)) {
        const ext = options.language === 'ts' ? '.ts' : '.js';
        resolvedPath += ext;
      }
      
      // Add edge to the graph
      graph.edges.push({
        source: filePath,
        target: resolvedPath,
        type: 'import'
      });
    }
  }
}

// Function to convert graph to JSON
function graphToJson(graph: Graph): any {
  const nodes = Array.from(graph.nodes.values()).map(node => ({
    id: node.id
  }));
  
  return {
    nodes,
    edges: graph.edges
  };
}

// Function to print graph summary
function printGraphSummary(graph: Graph): void {
  console.log(chalk.blue('\nGraph Summary:'));
  console.log(`Total files: ${graph.nodes.size}`);
  console.log(`Total dependencies: ${graph.edges.length}`);
}

function extractImports(filePath: string): string[] {
  // Read the file content
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const imports: string[] = [];
  
  // Create a source file
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  // Visit each node in the source file
  ts.forEachChild(sourceFile, node => {
    // Check if the node is an import declaration
    if (ts.isImportDeclaration(node)) {
      // Get the module specifier (the string in the import statement)
      const moduleSpecifier = node.moduleSpecifier;
      
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        
        // Only include relative imports (starting with .)
        if (importPath.startsWith('.')) {
          imports.push(importPath);
        }
      }
    }
  });
  return imports;
}