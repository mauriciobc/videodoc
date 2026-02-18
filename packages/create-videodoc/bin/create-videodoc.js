#!/usr/bin/env node
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { scaffold } from '../lib/scaffold.js';

const pkg = { version: '0.1.0' };

console.log(chalk.cyan.bold(`\n  create-videodoc v${pkg.version}\n`));
console.log(chalk.gray('  Automated documentation video toolkit\n'));

const args = process.argv.slice(2);

if (args.length === 0 || args[0] !== 'init') {
  console.log(chalk.yellow('Usage: npx create-videodoc init\n'));
  process.exit(0);
}

async function main() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'My App',
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Dev server URL:',
      default: 'http://localhost:3000',
    },
    {
      type: 'list',
      name: 'stateMethod',
      message: 'How will you seed app state for journeys?',
      choices: [
        { name: 'localStorage', value: 'localStorage' },
        { name: 'API endpoints', value: 'api' },
        { name: 'Database seeding', value: 'database' },
        { name: 'Manual setup', value: 'manual' },
      ],
      default: 'localStorage',
    },
    {
      type: 'input',
      name: 'primaryColor',
      message: 'Primary brand color (hex):',
      default: '#6366f1',
      validate: (input) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(input) || 'Please enter a valid hex color',
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory for screenshots and videos:',
      default: './docs-output',
    },
    {
      type: 'list',
      name: 'fps',
      message: 'Video frame rate:',
      choices: [
        { name: '30 fps (recommended)', value: 30 },
        { name: '60 fps (smoother)', value: 60 },
      ],
      default: 30,
    },
    {
      type: 'list',
      name: 'resolution',
      message: 'Video resolution:',
      choices: [
        { name: '1920 × 1080 (Full HD)', value: { width: 1920, height: 1080 } },
        { name: '1280 × 720 (HD)', value: { width: 1280, height: 720 } },
        { name: '1280 × 800 (16:10)', value: { width: 1280, height: 800 } },
      ],
      default: { width: 1920, height: 1080 },
    },
  ]);

  const spinner = ora('Scaffolding docs-automation folder...').start();

  try {
    await scaffold(answers);
    spinner.succeed('Scaffolding complete!');

    console.log(chalk.green('\n  Next steps:\n'));
    console.log(chalk.white('  1.'), 'Install dependencies:', chalk.cyan('npm install'));
    console.log(chalk.white('  2.'), 'Edit seed data:', chalk.cyan('docs-automation/fixtures/seed-data.js'));
    console.log(chalk.white('  3.'), 'Write your first journey:', chalk.cyan('docs-automation/journeys/'));
    console.log(chalk.white('  4.'), 'Run screenshots:', chalk.cyan('npm run docs:screenshots'));
    console.log(chalk.white('  5.'), 'Preview video:', chalk.cyan('npm run docs:preview'));
    console.log(chalk.white('  6.'), 'Render final:', chalk.cyan('npm run docs:render'));
    console.log();
  } catch (error) {
    spinner.fail('Scaffolding failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

main();
