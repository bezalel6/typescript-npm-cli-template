import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// Helper function to visit nodes and collect imports
const visitNode = (
  node: ts.Node,
  sourceFile: ts.SourceFile,
  imports: string[]
): void => {
  if (
    ts.isImportDeclaration(node) ||
    ts.isImportEqualsDeclaration(node) ||
    ts.isExportDeclaration(node)
  ) {
    imports.push(node.getText(sourceFile));
  }

  ts.forEachChild(node, (childNode) => visitNode(childNode, sourceFile, imports));
};

// Function to extract imports from a TypeScript file
function extractImports(filePath: string): string[] {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    const imports: string[] = [];
    visitNode(sourceFile, sourceFile, imports);
    return imports;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, (error as Error).message);
    return [];
  }
}

// Function to recursively find all TypeScript files in a directory
function findTypeScriptFiles(dirPath: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findTypeScriptFiles(filePath, fileList);
    } else if (
      stat.isFile() &&
      (file.endsWith('.ts') || file.endsWith('.tsx')) &&
      !file.endsWith('.d.ts')
    ) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main function
function analyzeImports(directoryPath: string): void {
  // Resolve the directory path
  const resolvedPath = path.resolve(directoryPath);
  console.log(`Analyzing TypeScript imports in: ${resolvedPath}\n`);

  // Find all TypeScript files
  const tsFiles = findTypeScriptFiles(resolvedPath);
  
  if (tsFiles.length === 0) {
    console.log('No TypeScript files found in the specified directory.');
    return;
  }

  // Process each file
  tsFiles.forEach((filePath) => {
    const relativePath = path.relative(resolvedPath, filePath);
    const imports = extractImports(filePath);
    
    console.log(`\n--- ${relativePath} ---`);
    
    if (imports.length === 0) {
      console.log('No imports found.');
    } else {
      imports.forEach((importStatement) => {
        console.log(importStatement);
      });
    }
  });
}

// Check if directory path is provided as command line argument
const directoryPath = process.argv[2] || '.';
analyzeImports(directoryPath);
