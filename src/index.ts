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

export async function analyzeFiles(options: AnalyzeOptions): Promise<void> {
  try {
    // Find all files matching the glob pattern
    const files = await glob(options.glob);
    
    if (files.length === 0) {
      console.log(chalk.yellow(`No files found matching pattern: ${options.glob}`));
      return;
    }
    
    console.log(chalk.blue(`Found ${files.length} files to analyze...`));
    
    // Analyze each file for imports
    const results: ImportInfo[] = [];
    
    for (const filePath of files) {
      try {
        const imports = extractImports(filePath);
        results.push({
          filePath,
          imports
        });
        
        console.log(chalk.green(`✓ Processed ${filePath}`));
        console.log(`  Imports: ${imports.length > 0 ? imports.join(', ') : 'none'}`);
      } catch (error) {
        console.error(chalk.red(`Error processing ${filePath}:`), error);
      }
    }
    
    // Output results
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
      console.log(chalk.blue(`Results written to ${options.output}`));
    }
    
    // Print summary
    const totalImports = results.reduce((sum, file) => sum + file.imports.length, 0);
    console.log(chalk.blue('\nSummary:'));
    console.log(`Total files analyzed: ${results.length}`);
    console.log(`Total imports found: ${totalImports}`);
    
  } catch (error) {
    console.error(chalk.red('Error during analysis:'), error);
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
