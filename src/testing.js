"use strict";
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
// Function to extract imports from a TypeScript file
function extractImports(filePath) {
    try {
        var fileContent = fs.readFileSync(filePath, 'utf8');
        var sourceFile_1 = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
        var imports_1 = [];
        // Visit each node in the source file
        function visit(node) {
            if (ts.isImportDeclaration(node) ||
                ts.isImportEqualsDeclaration(node) ||
                ts.isExportDeclaration(node)) {
                imports_1.push(node.getText(sourceFile_1));
            }
            ts.forEachChild(node, visit);
        }
        visit(sourceFile_1);
        return imports_1;
    }
    catch (error) {
        console.error("Error processing ".concat(filePath, ":"), error.message);
        return [];
    }
}
// Function to recursively find all TypeScript files in a directory
function findTypeScriptFiles(dirPath, fileList) {
    if (fileList === void 0) { fileList = []; }
    var files = fs.readdirSync(dirPath);
    files.forEach(function (file) {
        var filePath = path.join(dirPath, file);
        var stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            findTypeScriptFiles(filePath, fileList);
        }
        else if (stat.isFile() &&
            (file.endsWith('.ts') || file.endsWith('.tsx')) &&
            !file.endsWith('.d.ts')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}
// Main function
function analyzeImports(directoryPath) {
    // Resolve the directory path
    var resolvedPath = path.resolve(directoryPath);
    console.log("Analyzing TypeScript imports in: ".concat(resolvedPath, "\n"));
    // Find all TypeScript files
    var tsFiles = findTypeScriptFiles(resolvedPath);
    if (tsFiles.length === 0) {
        console.log('No TypeScript files found in the specified directory.');
        return;
    }
    // Process each file
    tsFiles.forEach(function (filePath) {
        var relativePath = path.relative(resolvedPath, filePath);
        var imports = extractImports(filePath);
        console.log("\n--- ".concat(relativePath, " ---"));
        if (imports.length === 0) {
            console.log('No imports found.');
        }
        else {
            imports.forEach(function (importStatement) {
                console.log(importStatement);
            });
        }
    });
}
// Check if directory path is provided as command line argument
var directoryPath = process.argv[2] || '.';
analyzeImports(directoryPath);
