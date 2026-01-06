import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Deep merge objects - user config overrides defaults
 */
export function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = deepMerge(defaults[key] || {}, overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

const DEFAULTS = {
  production_branch: 'main',
  build: {
    command: 'npm run build',
    output: 'dist',
    root: '',
  },
  preview: {
    branches: ['*'],
    exclude: [],
  },
};

const WORKER_DEFAULTS = {
  main: 'worker/worker.js',
};

/**
 * Apply smart defaults to the config
 * @param {object} config - Raw config from cloudflare.json
 * @param {string} workingDir - Working directory
 * @param {object} options - Options like repo info from environment
 * @returns {object} - Config with defaults applied
 */
export function applyDefaults(config, workingDir, options = {}) {
  const { repoOwner, repoName } = options;

  // Merge with defaults
  let result = deepMerge(DEFAULTS, config);

  // Auto-detect repo from environment
  if (!result.repo && repoOwner && repoName) {
    result.repo = { owner: repoOwner, name: repoName };
  }

  // Auto-detect worker folder
  const hasWorkerFolder = existsSync(join(workingDir, 'worker'));
  if (!result.worker && hasWorkerFolder) {
    console.log('Detected worker/ folder, enabling worker deployment');
    result.worker = {};
  }

  // Apply worker defaults if worker is configured
  if (result.worker) {
    const workerDefaults = {
      ...WORKER_DEFAULTS,
      compatibility_date: new Date().toISOString().split('T')[0],
    };
    result.worker = deepMerge(workerDefaults, result.worker);
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
