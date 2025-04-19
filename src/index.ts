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
  format?: 'json' | 'd3' | 'dot' | 'html';
  open?: boolean; // Whether to open the HTML visualization
}
// Add these interfaces to your code
interface Node {
  id: string;
  imports: string[];
  exports: Map<string, string>; // name -> type (function, class, etc.)
  calls: Set<string>; // function names called in this file
}

interface Graph {
  nodes: Map<string, Node>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    function?: string; // Optional function name for call edges
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
        
        // Extract exports and function calls
        const { exports, calls } = extractExportsAndCalls(filePath);
        
        // Add node to graph
        graph.nodes.set(filePath, {
          id: filePath,
          imports,
          exports,
          calls
        });
        
        console.log(chalk.green(`✓ Processed ${filePath}`));
        console.log(`  Imports: ${imports.length > 0 ? imports.join(', ') : 'none'}`);
        console.log(`  Exports: ${exports.size > 0 ? Array.from(exports.keys()).join(', ') : 'none'}`);
        console.log(`  Calls: ${calls.size > 0 ? Array.from(calls).join(', ') : 'none'}`);
      } catch (error) {
        console.error(chalk.red(`Error processing ${filePath}:`), error);
      }
    }
    
    // Build graph edges for imports
    buildImportEdges(graph, options);
    
    // Build graph edges for function calls
    buildCallEdges(graph);
    
    // Output the graph
    if (options.output) {
      let outputContent = '';
      
      switch (options.format || 'json') {
        case 'json':
          outputContent = JSON.stringify(graphToJson(graph), null, 2);
          break;
        case 'd3':
          outputContent = exportD3Format(graph);
          break;
        case 'dot':
          outputContent = exportDotFormat(graph);
          break;
        case 'html':
          generateHtmlVisualization(graph, options.output, options);
          return;
      }
      
      fs.writeFileSync(options.output, outputContent);
      console.log(chalk.blue(`Graph written to ${options.output} in ${options.format || 'json'} format`));
    }
    
    // Print summary
    printGraphSummary(graph);
    
  } catch (error) {
    console.error(chalk.red('Error during analysis:'), error);
  }
}

// Function to build import edges
function buildImportEdges(graph: Graph, options: AnalyzeOptions): void {
  // Get the project root directory (assuming it's the directory containing the glob pattern)
  const projectRoot = path.dirname('.');
  
  for (const [filePath, node] of graph.nodes.entries()) {
    const dir = path.dirname(filePath);
    
    for (const importPath of node.imports) {
      // First resolve to absolute path
      let absolutePath = path.resolve(dir, importPath);
      
      // Handle extensions
      if (!path.extname(absolutePath)) {
        const ext = options.language === 'ts' ? '.ts' : '.js';
        absolutePath += ext;
      }
      
      // Convert to path relative to project root
      const relativePath = path.relative(projectRoot, absolutePath);
      
      // Add edge to the graph
      graph.edges.push({
        source: path.relative(projectRoot, filePath),
        target: relativePath,
        type: 'import'
      });
    }
  }
}

// Function to build call edges
function buildCallEdges(graph: Graph): void {
  // Create a map of exported functions
  const exportedFunctions = new Map<string, string>(); // functionName -> filePath
  
  for (const [filePath, node] of graph.nodes.entries()) {
    for (const [exportName, exportType] of node.exports.entries()) {
      if (exportType === 'function') {
        exportedFunctions.set(exportName, filePath);
      }
    }
  }
  
  // Add edges for function calls
  for (const [filePath, node] of graph.nodes.entries()) {
    for (const call of node.calls) {
      // Check if this call is to an exported function
      if (exportedFunctions.has(call)) {
        const targetFile = exportedFunctions.get(call)!;
        
        // Don't add self-references
        if (filePath !== targetFile) {
          graph.edges.push({
            source: filePath,
            target: targetFile,
            type: 'call',
            function: call
          });
        }
      }
    }
  }
}

// Function to convert graph to JSON
function graphToJson(graph: Graph): any {
  const nodes = Array.from(graph.nodes.values()).map(node => {
    return {
      id: node.id,
      label: path.basename(node.id),
      exports: Array.from(node.exports.keys()),
      calls: Array.from(node.calls)
    };
  });
  
  const edges = graph.edges.map(edge => {
    return {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.type === 'call' ? edge.function : undefined
    };
  });
  
  return {
    nodes,
    edges
  };
}

// Add a function to detect circular dependencies
function detectCircularDependencies(graph: Graph): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  
  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type === 'import') {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, []);
      }
      adjacencyList.get(edge.source)!.push(edge.target);
    }
  }
  
  function dfs(node: string, path: string[] = []): boolean {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    const neighbors = adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  // Run DFS from each node
  for (const node of graph.nodes.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return cycles;
}

// Update the printGraphSummary function
function printGraphSummary(graph: Graph): void {
  console.log(chalk.blue('\nGraph Summary:'));
  console.log(`Total files: ${graph.nodes.size}`);
  
  const importEdges = graph.edges.filter(e => e.type === 'import').length;
  const callEdges = graph.edges.filter(e => e.type === 'call').length;
  
  console.log(`Total import dependencies: ${importEdges}`);
  console.log(`Total function call dependencies: ${callEdges}`);
  
  // Detect circular dependencies
  const cycles = detectCircularDependencies(graph);
  if (cycles.length > 0) {
    console.log(chalk.yellow('\nCircular Dependencies Detected:'));
    cycles.forEach((cycle, index) => {
      console.log(`${index + 1}. ${cycle.map(file => path.basename(file)).join(' → ')} → ${path.basename(cycle[0])}`);
    });
  }
  
  // Find most imported files
  const importCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.type === 'import') {
      const count = importCounts.get(edge.target) || 0;
      importCounts.set(edge.target, count + 1);
    }
  }
  
  const mostImported = Array.from(importCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (mostImported.length > 0) {
    console.log(chalk.blue('\nMost Imported Files:'));
    mostImported.forEach(([file, count]) => {
      console.log(`${path.basename(file)}: ${count} imports`);
    });
  }
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

// Add a function to extract exports and function calls
function extractExportsAndCalls(filePath: string): { exports: Map<string, string>; calls: Set<string> } {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const exports = new Map<string, string>();
  const calls = new Set<string>();
  
  // Create a source file
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  // Visit each node to find exports and calls
  function visit(node: ts.Node) {
    // Check for function declarations and exports
    if (ts.isFunctionDeclaration(node) && node.name) {
      const functionName = node.name.text;
      
      // Check if it's exported
      if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        exports.set(functionName, 'function');
      }
    }
    
    // Check for variable declarations with exports
    if (ts.isVariableStatement(node)) {
      if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        node.declarationList.declarations.forEach(decl => {
          if (ts.isIdentifier(decl.name)) {
            const varType = decl.initializer && 
                           (ts.isFunctionExpression(decl.initializer) || 
                            ts.isArrowFunction(decl.initializer)) 
                           ? 'function' : 'variable';
            exports.set(decl.name.text, varType);
          }
        });
      }
    }
    
    // Check for export assignments
    if (ts.isExportAssignment(node)) {
      if (ts.isIdentifier(node.expression)) {
        exports.set(node.expression.text, 'default');
      }
    }
    
    // Check for call expressions
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        calls.add(node.expression.text);
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        if (ts.isIdentifier(node.expression.expression) && 
            ts.isIdentifier(node.expression.name)) {
          calls.add(`${node.expression.expression.text}.${node.expression.name.text}`);
        }
      }
    }
    
    // Continue visiting child nodes
    ts.forEachChild(node, visit);
  }
  
  ts.forEachChild(sourceFile, visit);
  
  return { exports, calls };
}

// Add a function to export in DOT format (for Graphviz)
function exportDotFormat(graph: Graph): string {
  let dot = 'digraph DependencyGraph {\n';
  dot += '  node [shape=box];\n';
  
  // Add nodes
  for (const [id, node] of graph.nodes.entries()) {
    const label = path.basename(id);
    dot += `  "${id}" [label="${label}"];\n`;
  }
  
  // Add edges
  for (const edge of graph.edges) {
    const style = edge.type === 'import' ? 'solid' : 'dashed';
    const color = edge.type === 'import' ? 'black' : 'blue';
    const label = edge.type === 'call' && edge.function ? edge.function : '';
    
    dot += `  "${edge.source}" -> "${edge.target}" [style=${style}, color=${color}, label="${label}"];\n`;
  }
  
  dot += '}\n';
  return dot;
}

// Add a function to export in D3.js format
function exportD3Format(graph: Graph): string {
  const nodes = Array.from(graph.nodes.values()).map(node => {
    return {
      id: node.id,
      label: path.basename(node.id),
      group: node.exports.size > 0 ? 1 : 2
    };
  });
  
  const links = graph.edges.map(edge => {
    return {
      source: edge.source,
      target: edge.target,
      value: edge.type === 'import' ? 2 : 1,
      type: edge.type
    };
  });
  
  const d3Data = {
    nodes,
    links
  };
  
  return JSON.stringify(d3Data, null, 2);
}

// Add a function to generate HTML visualization
function generateHtmlVisualization(graph: Graph, outputPath: string, options: AnalyzeOptions): void {
  const d3Data = exportD3Format(graph);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dependency Graph Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    #graph { width: 100vw; height: 100vh; }
    .node { cursor: pointer; }
    .link { stroke-opacity: 0.6; }
    .node text { font-size: 10px; }
    .tooltip {
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      pointer-events: none;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="graph"></div>
  <script>
    const data = ${d3Data};
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Create a tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);
    
    // Create the simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));
    
    // Create the SVG container
    const svg = d3.select("#graph")
      .append("svg")
      .attr("width", width)
      .attr("height", height);
    
    // Add zoom behavior
    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      }));
    
    const container = svg.append("g");
    
    // Create the links
    const link = container.append("g")
      .selectAll("line")
      .data(data.links)
      .enter().append("line")
      .attr("stroke", d => d.type === "import" ? "#999" : "#66f")
      .attr("stroke-width", d => d.value)
      .attr("stroke-dasharray", d => d.type === "call" ? "5,5" : "")
      .attr("class", "link");
    
    // Create the nodes
    const node = container.append("g")
      .selectAll(".node")
      .data(data.nodes)
      .enter().append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
    // Add circles to nodes
    node.append("circle")
      .attr("r", 8)
      .attr("fill", d => d.group === 1 ? "#f66" : "#6cf");
    
    // Add labels to nodes
    node.append("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .text(d => d.label);
    
    // Add tooltips
    node.on("mouseover", function(event, d) {
      tooltip.transition()
        .duration(200)
        .style("opacity", .9);
      tooltip.html(d.id)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    });
    
    // Update positions on each tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      node
        .attr("transform", d => \`translate(\${d.x},\${d.y})\`);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(outputPath, html);
  console.log(chalk.blue(`HTML visualization written to ${outputPath}`));
  
  // Open in browser if requested
  if (options.open) {
    const open = require('open');
    open(outputPath);
    console.log(chalk.green(`Opened ${outputPath} in your browser`));
  }
}