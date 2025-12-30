#!/usr/bin/env node
import Cloudflare from 'cloudflare';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { syncPages } from './lib/pages.mjs';
import { syncWorker } from './lib/workers.mjs';

async function main() {
  // Read environment variables
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const configPath = process.env.CONFIG_PATH;
  const allowRecreateEnv = process.env.ALLOW_RECREATE === 'true';
  const deployWorker = process.env.DEPLOY_WORKER !== 'false';
  const branch = process.env.BRANCH || 'main';

  // Parse worker secrets from JSON
  let workerSecrets = {};
  try {
    workerSecrets = JSON.parse(process.env.WORKER_SECRETS || '{}');
  } catch (err) {
    console.error('Warning: Failed to parse WORKER_SECRETS as JSON');
  }

  // Validate required inputs
  if (!apiToken || !accountId) {
    console.error('Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set');
    process.exit(1);
  }

  if (!configPath) {
    console.error('Error: CONFIG_PATH must be set');
    process.exit(1);
  }

  // Load configuration
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const allowRecreate = allowRecreateEnv || config.allow_recreate === true;

  // Get working directory (parent of config file)
  const workingDir = dirname(configPath);

  console.log('==================================================');
  console.log('Cloudflare Pages & Workers Sync');
  console.log('==================================================');
  console.log(`Branch: ${branch}`);
  console.log(`Production branch: ${config.production_branch}`);

  // Initialize Cloudflare client
  const client = new Cloudflare({ apiToken });

  // Sync Pages
  const pagesResult = await syncPages(client, accountId, config, allowRecreate);

  // Sync Worker (if configured and enabled)
  let workerResult = null;
  if (deployWorker && config.worker) {
    workerResult = await syncWorker(client, accountId, config, branch, workerSecrets, workingDir);
  }

  // Summary
  console.log('\n==================================================');
  console.log('Deployment Summary');
  console.log('==================================================');
  console.log(`Pages URL: ${pagesResult.pagesUrl}`);
  if (workerResult) {
    console.log(`Worker URL: ${workerResult.workerUrl}`);
    console.log(`Worker Name: ${workerResult.workerName}`);
  }
  console.log('==================================================');
}

main().catch((err) => {
  console.error('Error:', err.message);
  if (err.errors) {
    console.error('Details:', JSON.stringify(err.errors, null, 2));
  }
  process.exit(1);
});
