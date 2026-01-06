import { appendFileSync } from 'fs';

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
