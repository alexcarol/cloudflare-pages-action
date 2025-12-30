import { appendFileSync } from 'fs';

/**
 * Normalize a branch name for use in worker names
 * - Replace / with -
 * - Convert to lowercase
 * @param {string} branch
 * @returns {string}
 */
export function normalizeBranchName(branch) {
  return branch
    .replace(/\//g, '-')
    .toLowerCase();
}

/**
 * Determine if this is a production deployment
 * @param {string} branch
 * @param {string} productionBranch
 * @returns {boolean}
 */
export function isProduction(branch, productionBranch) {
  return branch === productionBranch;
}

/**
 * Generate the worker name based on branch
 * @param {string} baseName - Base worker name from config
 * @param {string} branch - Current branch
 * @param {string} productionBranch - Production branch name
 * @returns {string}
 */
export function getWorkerName(baseName, branch, productionBranch) {
  if (isProduction(branch, productionBranch)) {
    return baseName;
  }
  const normalizedBranch = normalizeBranchName(branch);
  return `${normalizedBranch}-${baseName}`;
}

/**
 * Set GitHub Action output
 * @param {string} name
 * @param {string} value
 */
export function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
}
