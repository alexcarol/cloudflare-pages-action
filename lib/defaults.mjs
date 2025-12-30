import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Get today's date in YYYY-MM-DD format for compatibility_date
 * @returns {string}
 */
function getCompatibilityDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Detect if a worker folder exists in the project
 * @param {string} workingDir
 * @returns {boolean}
 */
function hasWorkerFolder(workingDir) {
  return existsSync(join(workingDir, 'worker'));
}

/**
 * Apply smart defaults to the config
 * - Minimal config: just "name" is required
 * - Auto-detect worker folder to enable worker deployment
 * - Default build command is "npm run build"
 * - Default output directory is "dist"
 * - Enable both pages and worker branch deploys by default
 *
 * @param {object} config - Raw config from cloudflare.json
 * @param {string} workingDir - Working directory
 * @param {object} options - Options like repo info from environment
 * @returns {object} - Config with defaults applied
 */
export function applyDefaults(config, workingDir, options = {}) {
  const { repoOwner, repoName } = options;

  // Start with the provided config
  const result = { ...config };

  // Default production branch
  if (!result.production_branch) {
    result.production_branch = 'main';
  }

  // Default repo info (can be auto-detected from GitHub Actions env)
  if (!result.repo) {
    result.repo = {};
  }
  if (!result.repo.owner && repoOwner) {
    result.repo.owner = repoOwner;
  }
  if (!result.repo.name && repoName) {
    result.repo.name = repoName;
  }

  // Default build config
  if (!result.build) {
    result.build = {};
  }
  if (!result.build.command) {
    result.build.command = 'npm run build';
  }
  if (!result.build.output) {
    result.build.output = 'dist';
  }
  if (result.build.root === undefined) {
    result.build.root = '';
  }

  // Default preview config (enable all branches by default)
  if (!result.preview) {
    result.preview = {};
  }
  if (!result.preview.branches) {
    result.preview.branches = ['*'];
  }
  if (!result.preview.exclude) {
    result.preview.exclude = [];
  }

  // Auto-detect worker folder and apply worker defaults
  if (!result.worker && hasWorkerFolder(workingDir)) {
    console.log('Detected worker/ folder, enabling worker deployment with defaults');
    result.worker = {};
  }

  // Apply worker defaults if worker is configured (explicitly or auto-detected)
  if (result.worker) {
    if (!result.worker.name) {
      result.worker.name = result.name;
    }
    if (!result.worker.main) {
      result.worker.main = 'worker/worker.js';
    }
    if (!result.worker.compatibility_date) {
      result.worker.compatibility_date = getCompatibilityDate();
    }
    if (result.worker.deploy_previews === undefined) {
      result.worker.deploy_previews = true;
    }
    // build_command is optional - no default (worker.js might be pre-built)
    // bindings are optional - no default
  }

  return result;
}

/**
 * Extract repo info from GITHUB_REPOSITORY env var
 * @returns {{ repoOwner: string, repoName: string } | null}
 */
export function getRepoInfoFromEnv() {
  const githubRepo = process.env.GITHUB_REPOSITORY;
  if (!githubRepo) {
    return null;
  }
  const [owner, name] = githubRepo.split('/');
  return { repoOwner: owner, repoName: name };
}
