#!/usr/bin/env node
import Cloudflare from 'cloudflare';
import { readFileSync } from 'fs';

async function main() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const configPath = process.env.CONFIG_PATH;
  const allowRecreateEnv = process.env.ALLOW_RECREATE === 'true';

  if (!apiToken || !accountId) {
    console.error('Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set');
    process.exit(1);
  }

  if (!configPath) {
    console.error('Error: CONFIG_PATH must be set');
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const allowRecreate = allowRecreateEnv || config.allow_recreate === true;

  console.log(`Project: ${config.name}`);
  console.log(`Repo: ${config.repo.owner}/${config.repo.name}`);
  console.log(`Production branch: ${config.production_branch}`);

  const client = new Cloudflare({ apiToken });

  let existingProject = null;
  try {
    existingProject = await client.pages.projects.get(config.name, { account_id: accountId });
    console.log('\nProject exists, checking configuration...');
  } catch (err) {
    if (err.status === 404) {
      console.log('\nProject does not exist, creating...');
    } else {
      throw err;
    }
  }

  const sourceConfig = {
    type: 'github',
    config: {
      owner: config.repo.owner,
      repo_name: config.repo.name,
      production_branch: config.production_branch,
      deployments_enabled: true,
      production_deployments_enabled: true,
      preview_deployment_setting: 'all',
      preview_branch_includes: config.preview?.branches || ['*'],
      preview_branch_excludes: config.preview?.exclude || [],
    },
  };

  const buildConfig = {
    build_command: config.build?.command || '',
    destination_dir: config.build?.output || '.',
    root_dir: config.build?.root || '',
  };

  if (existingProject) {
    const hasGitHubSource = existingProject.source?.type === 'github';

    if (!hasGitHubSource) {
      if (!allowRecreate) {
        console.error('\n❌ ERROR: Project exists as a Direct Upload project.');
        console.error('To migrate to GitHub integration, the project must be deleted and recreated.');
        console.error('\nTo allow this, either:');
        console.error('  1. Run the workflow manually with "Allow recreate" checked');
        console.error('  2. Add "allow_recreate": true to cloudflare.json (then remove it after)');
        console.error('\n⚠️  WARNING: This will delete all existing deployments and history!');
        process.exit(1);
      }

      console.log('Project is a Direct Upload project, deleting to recreate with GitHub source...');
      await client.pages.projects.delete(config.name, { account_id: accountId });
      console.log('Project deleted, recreating with GitHub integration...');

      await client.pages.projects.create({
        account_id: accountId,
        name: config.name,
        production_branch: config.production_branch,
        source: sourceConfig,
        build_config: buildConfig,
      });
      console.log('Project recreated with GitHub integration!');
    } else {
      console.log('Updating existing GitHub-connected project...');
      await client.pages.projects.edit(config.name, {
        account_id: accountId,
        production_branch: config.production_branch,
        source: sourceConfig,
        build_config: buildConfig,
        deployment_configs: {
          preview: {},
          production: {},
        },
      });
      console.log('Configuration updated successfully');
    }
  } else {
    await client.pages.projects.create({
      account_id: accountId,
      name: config.name,
      production_branch: config.production_branch,
      source: sourceConfig,
      build_config: buildConfig,
    });
    console.log('Project created with GitHub integration!');
    console.log('Cloudflare will now auto-deploy on every push.');
  }

  console.log('\n================================');
  console.log(`Production URL: https://${config.name}.pages.dev`);
  console.log(`Dashboard: https://dash.cloudflare.com/${accountId}/pages/view/${config.name}`);
  console.log('================================');
}

main().catch((err) => {
  console.error('Error:', err.message);
  if (err.errors) {
    console.error('Details:', JSON.stringify(err.errors, null, 2));
  }
  process.exit(1);
});
