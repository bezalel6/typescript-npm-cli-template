import fs from 'fs';
import path from 'path';
import glob from 'glob';
import * as parser from '@typescript-eslint/parser';
import { AST_NODE_TYPES } from '@typescript-eslint/types';
import chalk from 'chalk';

// Define the graph structure
interface Node {
  id: string;
  imports: string[];
  calls: Map<string, Set<string>>; // file -> set of function names
}

interface Graph {
  nodes: Map<string, Node>;
}

interface AnalyzeOptions {
  glob: string;
  language: 'ts' | 'js';
  output?: string;
}

export async function analyzeFiles(options: AnalyzeOptions): Promise<void> {
  const graph: Graph = { nodes: new Map() };
  const files = await glob.glob(options.glob);

  if (files.length === 0) {
    console.error(
      chalk.red(`No files found matching pattern: ${options.glob}`)
    );
    process.exit(1);
  }

  console.log(chalk.blue(`Found ${files.length} files to analyze...`));

  // Process each file
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const node: Node = {
        id: file,
        imports: [],
        calls: new Map(),
      };

      // Parse the file
      const ast = parser.parse(content, {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        filePath: file,
        project: options.language === 'ts' ? './tsconfig.json' : undefined,
      });

      // Extract imports
      extractImports(ast, node);

      // Extract function calls
      extractFunctionCalls(ast, node);

      graph.nodes.set(file, node);
      console.log(chalk.green(`✓ Processed ${file}`));
    } catch (error) {
      console.error(chalk.red(`Error processing ${file}:`), error);
    }
  }

  // Resolve relative imports to absolute paths
  resolveImportPaths(graph, options);

  // Output the graph
  if (options.output) {
    fs.writeFileSync(
      options.output,
      JSON.stringify(graphToJson(graph), null, 2)
    );
    console.log(chalk.blue(`Graph written to ${options.output}`));
  } else {
    console.log(chalk.yellow('Graph:'), JSON.stringify(graphToJson(graph)));
  }

  // Print summary
  printSummary(graph);
}

// Extract imports from AST
function extractImports(ast: any, node: Node): void {
  function visit(astNode: any) {
    if (!astNode) return;

    if (
      astNode.type === AST_NODE_TYPES.ImportDeclaration ||
      astNode.type === 'ImportDeclaration'
    ) {
      const importPath = astNode.source.value;
      if (!importPath.startsWith('.')) return; // Skip non-relative imports
      node.imports.push(importPath);
    }

    // Visit children
    if (typeof astNode === 'object') {
      for (const key in astNode) {
        if (
          key !== 'parent' &&
          astNode[key] &&
          typeof astNode[key] === 'object'
        ) {
          visit(astNode[key]);
        }
      }
    }
  }

  visit(ast);
}

// Extract function calls from AST
function extractFunctionCalls(ast: any, node: Node): void {
  // This is a simplified version - a complete implementation would need
  // to track function definitions and their calls
  function visit(astNode: any) {
    if (!astNode) return;

    if (
      astNode.type === AST_NODE_TYPES.CallExpression ||
      astNode.type === 'CallExpression'
    ) {
      let callee = '';

      // Handle different types of callees
      if (
        astNode.callee.type === AST_NODE_TYPES.Identifier ||
        astNode.callee.type === 'Identifier'
      ) {
        callee = astNode.callee.name;
      } else if (
        (astNode.callee.type === AST_NODE_TYPES.MemberExpression ||
          astNode.callee.type === 'MemberExpression') &&
        astNode.callee.property
      ) {
        if (
          astNode.callee.object.type === AST_NODE_TYPES.Identifier ||
          astNode.callee.object.type === 'Identifier'
        ) {
          const obj = astNode.callee.object.name;
          const prop = astNode.callee.property.name;
          callee = `${obj}.${prop}`;
        }
      }

      if (callee) {
        // For simplicity, we're just recording the call in the current file
        if (!node.calls.has(node.id)) {
          node.calls.set(node.id, new Set());
        }
        node.calls.get(node.id)?.add(callee);
      }
    }

    // Visit children
    if (typeof astNode === 'object') {
      for (const key in astNode) {
        if (
          key !== 'parent' &&
          astNode[key] &&
          typeof astNode[key] === 'object'
        ) {
          visit(astNode[key]);
        }
      }
    }
  }

  visit(ast);
}

// Resolve relative import paths to absolute paths
function resolveImportPaths(graph: Graph, options: AnalyzeOptions): void {
  for (const [filePath, node] of graph.nodes.entries()) {
    const dir = path.dirname(filePath);

    const resolvedImports = node.imports.map(importPath => {
      let fullPath = path.resolve(dir, importPath);

      // Handle extensions
      if (!path.extname(fullPath)) {
        const ext = options.language === 'ts' ? '.ts' : '.js';
        fullPath += ext;
      }

      return fullPath;
    });

    node.imports = resolvedImports;
  }
}

// Convert graph to JSON-friendly format
function graphToJson(graph: Graph): any {
  const result: any = { nodes: [], edges: [] };

  for (const [id, node] of graph.nodes.entries()) {
    result.nodes.push({ id });

    // Add import edges
    for (const importPath of node.imports) {
      result.edges.push({
        source: id,
        target: importPath,
        type: 'import',
      });
    }

    // Add call edges
    for (const [source, calls] of node.calls.entries()) {
      for (const call of calls) {
        result.edges.push({
          source,
          target: call,
          type: 'call',
        });
      }
    }
  }

  return result;
}

// Print summary of the graph
function printSummary(graph: Graph): void {
  console.log(chalk.blue('\nSummary:'));
  console.log(`Total files analyzed: ${graph.nodes.size}`);

  let totalImports = 0;
  let totalCalls = 0;

  for (const node of graph.nodes.values()) {
    totalImports += node.imports.length;
    for (const calls of node.calls.values()) {
      totalCalls += calls.size;
    }
  }

  console.log(`Total imports: ${totalImports}`);
  console.log(`Total function calls: ${totalCalls}`);
}
