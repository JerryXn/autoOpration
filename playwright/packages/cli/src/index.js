#!/usr/bin/env node
const { Command } = require('commander');
const fetch = require('node-fetch');
const chalk = require('chalk');
const Table = require('cli-table3');
const path = require('path');
const fs = require('fs');

const program = new Command();
const ORCH_URL = process.env.ORCH_URL || 'http://localhost:3000';

program
  .name('pw-cli')
  .description('Playwright Platform CLI')
  .version('0.1.0');

program
  .command('list')
  .description('List available scripts')
  .action(async () => {
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      console.log(chalk.red('Scripts directory not found.'));
      return;
    }
    
    const table = new Table({
      head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Entry')],
      colWidths: [25, 30, 20]
    });

    const entries = fs.readdirSync(scriptsDir);
    for (const entry of entries) {
      const metaPath = path.join(scriptsDir, entry, 'script.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = require(metaPath);
          table.push([entry, meta.name || 'N/A', meta.entry || 'index.js']);
        } catch (_) {}
      }
    }
    console.log(table.toString());
  });

program
  .command('run <scriptId>')
  .description('Start a script instance')
  .option('-p, --proxy <id>', 'Proxy ID')
  .option('-f, --fingerprint <id>', 'Fingerprint ID')
  .option('--persist-login', 'Enable persistent login')
  .option('--persist-mode <mode>', 'Persistence mode: state or profile', 'state')
  .option('--storage-key <key>', 'Storage key for state persistence')
  .option('--user-data-dir <dir>', 'User data directory for profile persistence')
  .option('--retry', 'Enable auto-retry')
  .option('--watch-chat <selector>', 'Enable chat watcher with selector')
  .action(async (scriptId, options) => {
    try {
      const body = {
        scriptId,
        proxyId: options.proxy,
        fingerprintId: options.fingerprint,
        persistLogin: options.persistLogin,
        persistMode: options.persistMode,
        storageKey: options.storageKey,
        userDataDir: options.userDataDir,
        retry: options.retry
      };

      if (options.watchChat) {
        body.options = { watch: { chatSelector: options.watchChat } };
      }

      const res = await fetch(`${ORCH_URL}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (res.ok) {
        console.log(chalk.green(`Script started successfully!`));
        console.log(`Run ID: ${chalk.yellow(data.id)}`);
        console.log(`PID: ${chalk.yellow(data.pid)}`);
      } else {
        console.log(chalk.red(`Failed to start script: ${data.error || 'Unknown error'}`));
      }
    } catch (err) {
      console.log(chalk.red(`Error: ${err.message}`));
      console.log(chalk.gray('Make sure orchestrator is running (npm start)'));
    }
  });

program
  .command('stop <runId>')
  .description('Stop a running instance')
  .action(async (runId) => {
    try {
      const res = await fetch(`${ORCH_URL}/runs/${runId}/stop`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        console.log(chalk.green(`Instance ${runId} stopped.`));
      } else {
        console.log(chalk.red(`Failed to stop: ${data.error}`));
      }
    } catch (err) {
      console.log(chalk.red(`Error: ${err.message}`));
    }
  });

program
  .command('pause <runId>')
  .description('Pause a running instance')
  .action(async (runId) => {
    try {
      const res = await fetch(`${ORCH_URL}/runs/${runId}/pause`, { method: 'POST' });
      if (res.ok) console.log(chalk.green(`Instance ${runId} paused.`));
      else console.log(chalk.red('Failed to pause.'));
    } catch (err) {
      console.log(chalk.red(`Error: ${err.message}`));
    }
  });

program
  .command('resume <runId>')
  .description('Resume a paused instance')
  .action(async (runId) => {
    try {
      const res = await fetch(`${ORCH_URL}/runs/${runId}/resume`, { method: 'POST' });
      if (res.ok) console.log(chalk.green(`Instance ${runId} resumed.`));
      else console.log(chalk.red('Failed to resume.'));
    } catch (err) {
      console.log(chalk.red(`Error: ${err.message}`));
    }
  });

program.parse(process.argv);
