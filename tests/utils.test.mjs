import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setOutput } from '../lib/utils.mjs';
import { appendFileSync } from 'fs';

vi.mock('fs', () => ({
  appendFileSync: vi.fn(),
}));

describe('utils', () => {
  describe('setOutput', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      delete process.env.GITHUB_OUTPUT;
    });

    it('should append to GITHUB_OUTPUT file when set', () => {
      process.env.GITHUB_OUTPUT = '/tmp/github_output';
      setOutput('test-name', 'test-value');
      expect(appendFileSync).toHaveBeenCalledWith('/tmp/github_output', 'test-name=test-value\n');
    });

    it('should do nothing when GITHUB_OUTPUT is not set', () => {
      delete process.env.GITHUB_OUTPUT;
      setOutput('test-name', 'test-value');
      expect(appendFileSync).not.toHaveBeenCalled();
    });

    it('should handle various value types', () => {
      process.env.GITHUB_OUTPUT = '/tmp/github_output';
      setOutput('url', 'https://example.com');
      expect(appendFileSync).toHaveBeenCalledWith('/tmp/github_output', 'url=https://example.com\n');
    });
  });
});
