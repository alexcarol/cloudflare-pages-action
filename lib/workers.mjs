import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { basename } from 'path';
import { getWorkerName, isProduction, setOutput } from './utils.mjs';

/**
 * Build bindings array from config
 * @param {object} bindingsConfig
 * @param {object} secrets - Secret values from action input
 * @returns {Array}
 */
export function buildBindings(bindingsConfig, secrets) {
  const bindings = [];

  // Environment variables -> plain_text bindings
  if (bindingsConfig?.environment_variables) {
    for (const [name, value] of Object.entries(bindingsConfig.environment_variables)) {
      bindings.push({
        name,
        type: 'plain_text',
        text: String(value),
      });
    }
  }

  // Secrets -> secret_text bindings
  if (secrets) {
    for (const [name, value] of Object.entries(secrets)) {
      bindings.push({
        name,
        type: 'secret_text',
        text: String(value),
      });
    }
  }

  // KV namespaces
  if (bindingsConfig?.kv_namespaces) {
    for (const kv of bindingsConfig.kv_namespaces) {
      bindings.push({
        name: kv.binding,
        type: 'kv_namespace',
        namespace_id: kv.id,
      });
    }
  }

  // D1 databases
  if (bindingsConfig?.d1_databases) {
    for (const d1 of bindingsConfig.d1_databases) {
      bindings.push({
        name: d1.binding,
        type: 'd1',
        id: d1.database_id,
      });
    }
  }

  // R2 buckets
  if (bindingsConfig?.r2_buckets) {
    for (const r2 of bindingsConfig.r2_buckets) {
      bindings.push({
        name: r2.binding,
        type: 'r2_bucket',
        bucket_name: r2.bucket_name,
      });
    }
  }

  return bindings;
}

/**
 * Run the worker build command if specified
 * @param {string} buildCommand
 * @param {string} workingDir
 */
function runBuild(buildCommand, workingDir) {
  if (!buildCommand) {
    return;
  }

  console.log(`Running build command: ${buildCommand}`);
  try {
    execSync(buildCommand, {
      cwd: workingDir,
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('Build completed successfully');
  } catch (err) {
    console.error('Build failed:', err.message);
    throw err;
  }
}

/**
 * Deploy a Cloudflare Worker
 * @param {import('cloudflare').default} client - Cloudflare SDK client
 * @param {string} accountId
 * @param {object} config - Full cloudflare.json config
 * @param {string} branch - Current branch
 * @param {object} secrets - Secrets to set on the worker
 * @param {string} workingDir - Working directory for build commands
 * @returns {Promise<{workerName: string, workerUrl: string} | null>}
 */
export async function syncWorker(client, accountId, config, branch, secrets, workingDir) {
  const workerConfig = config.worker;
  if (!workerConfig) {
    console.log('\nNo worker configuration found, skipping worker deployment.');
    return null;
  }

  const isProductionDeploy = isProduction(branch, config.production_branch);

  // Check if we should deploy preview workers
  if (!isProductionDeploy && workerConfig.deploy_previews === false) {
    console.log('\nPreview worker deployments disabled, skipping.');
    return null;
  }

  const workerName = getWorkerName(
    config.name,
    branch,
    config.production_branch
  );

  console.log('\n=== Worker Deployment ===');
  console.log(`Worker name: ${workerName}`);
  console.log(`Entry point: ${workerConfig.main}`);
  console.log(`Branch: ${branch} (${isProductionDeploy ? 'production' : 'preview'})`);

  // Run build command if specified
  if (workerConfig.build_command) {
    runBuild(workerConfig.build_command, workingDir);
  }

  // Read the worker script content
  const scriptPath = `${workingDir}/${workerConfig.main}`;
  let scriptContent;
  try {
    scriptContent = readFileSync(scriptPath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read worker script at ${scriptPath}:`, err.message);
    throw err;
  }

  // Build bindings
  const bindings = buildBindings(workerConfig.bindings, secrets);

  // Get the filename from the path for main_module
  const mainModule = basename(workerConfig.main);

  // Build metadata for the worker
  const metadata = {
    main_module: mainModule,
    compatibility_date: workerConfig.compatibility_date,
    compatibility_flags: workerConfig.compatibility_flags || [],
    bindings,
  };

  try {
    // Create a File object for the script
    const scriptFile = new File([scriptContent], mainModule, {
      type: 'application/javascript+module',
    });

    // Deploy the worker (update creates if not exists)
    console.log('Uploading worker script...');
    await client.workers.scripts.update(workerName, {
      account_id: accountId,
      metadata,
      files: [scriptFile],
    });

    console.log('Worker script deployed successfully.');

    // Get the subdomain for URL construction
    const subdomainInfo = await client.workers.subdomains.get({
      account_id: accountId,
    });
    const workerUrl = `https://${workerName}.${subdomainInfo.subdomain}.workers.dev`;

    console.log(`\nWorker URL: ${workerUrl}`);

    setOutput('worker-url', workerUrl);
    setOutput('worker-name', workerName);

    return { workerName, workerUrl };
  } catch (err) {
    console.error('Worker deployment failed:', err.message);
    if (err.errors) {
      console.error('Details:', JSON.stringify(err.errors, null, 2));
    }
    throw err;
  }
}
