# Dependency Analyzer Examples

This directory contains example projects to test the dependency analyzer.

## Sample Project

A simple TypeScript project with various imports and function calls to test the analyzer.

### Running the analyzer on the sample project

```bash
# From the project root
npm run test:example

# Or using the CLI directly
npx ts-node src/cli.ts --glob "examples/sample-project/src/**/*.ts" --language ts
```

The output will show the dependency graph between files in the sample project.
