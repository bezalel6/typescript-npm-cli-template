#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeFiles } from './index';

const program = new Command();

program
  .name('dependency-analyzer')
  .description('Analyze imports and function calls between files')
  .version('0.1.0')
  .requiredOption('-g, --glob <pattern>', 'Glob pattern to match files')
  .requiredOption(
    '-l, --language <language>',
    'Language to analyze (ts or js)',
    value => {
      if (value !== 'ts' && value !== 'js') {
        throw new Error('Language must be either "ts" or "js"');
      }
      return value;
    }
  )
  .option('-o, --output <file>', 'Output file for the graph (JSON format)')
  .action(async options => {
    try {
      await analyzeFiles(options);
    } catch (error) {
      console.error(
        chalk.red('Error:'),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

program.parse();

// Print out the parsed options
console.log(chalk.blue('Parsed options:'));
console.log(program.opts());
