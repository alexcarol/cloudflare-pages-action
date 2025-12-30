import { setOutput } from './utils.mjs';

/**
 * Sync Cloudflare Pages configuration
 * @param {import('cloudflare').default} client
 * @param {string} accountId
 * @param {object} config
 * @param {boolean} allowRecreate
 * @returns {Promise<{pagesUrl: string}>}
 */
export async function syncPages(client, accountId, config, allowRecreate) {
  console.log('\n=== Pages Configuration ===');
  console.log(`Project: ${config.name}`);
  console.log(`Repo: ${config.repo.owner}/${config.repo.name}`);
  console.log(`Production branch: ${config.production_branch}`);

  let existingProject = null;
  try {
    existingProject = await client.pages.projects.get(config.name, {
      account_id: accountId,
    });
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
        console.error('\nERROR: Project exists as a Direct Upload project.');
        console.error('To migrate to GitHub integration, the project must be deleted and recreated.');
        console.error('\nTo allow this, either:');
        console.error('  1. Run the workflow manually with "Allow recreate" checked');
        console.error('  2. Add "allow_recreate": true to cloudflare.json (then remove it after)');
        console.error('\nWARNING: This will delete all existing deployments and history!');
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

  const pagesUrl = `https://${config.name}.pages.dev`;
  console.log(`\nPages URL: ${pagesUrl}`);
  console.log(`Dashboard: https://dash.cloudflare.com/${accountId}/pages/view/${config.name}`);

  setOutput('pages-url', pagesUrl);

  return { pagesUrl };
}
