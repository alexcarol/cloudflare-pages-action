import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeBranchName, isProduction, getWorkerName, setOutput } from '../lib/utils.mjs';
import { appendFileSync } from 'fs';

vi.mock('fs', () => ({
  appendFileSync: vi.fn(),
}));

describe('utils', () => {
  describe('normalizeBranchName', () => {
    it('should replace slashes with dashes', () => {
      expect(normalizeBranchName('feature/auth')).toBe('feature-auth');
      expect(normalizeBranchName('feature/user/profile')).toBe('feature-user-profile');
    });

    it('should convert to lowercase', () => {
      expect(normalizeBranchName('Feature/Auth')).toBe('feature-auth');
      expect(normalizeBranchName('MAIN')).toBe('main');
    });

    it('should handle simple branch names', () => {
      expect(normalizeBranchName('main')).toBe('main');
      expect(normalizeBranchName('develop')).toBe('develop');
    });

    it('should handle complex branch names', () => {
      expect(normalizeBranchName('feature/JIRA-123/add-auth')).toBe('feature-jira-123-add-auth');
    });
  });

  describe('isProduction', () => {
    it('should return true when branch matches production branch', () => {
      expect(isProduction('main', 'main')).toBe(true);
      expect(isProduction('master', 'master')).toBe(true);
    });

    it('should return false when branch does not match production branch', () => {
      expect(isProduction('develop', 'main')).toBe(false);
      expect(isProduction('feature/auth', 'main')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isProduction('Main', 'main')).toBe(false);
      expect(isProduction('MAIN', 'main')).toBe(false);
    });
  });

  describe('getWorkerName', () => {
    it('should return base name for production branch', () => {
      expect(getWorkerName('my-worker', 'main', 'main')).toBe('my-worker');
      expect(getWorkerName('api', 'production', 'production')).toBe('api');
    });

    it('should prefix with normalized branch name for non-production', () => {
      expect(getWorkerName('my-worker', 'develop', 'main')).toBe('develop-my-worker');
      expect(getWorkerName('api', 'feature/auth', 'main')).toBe('feature-auth-api');
    });

    it('should handle complex branch names', () => {
      expect(getWorkerName('worker', 'feature/JIRA-123/auth', 'main'))
        .toBe('feature-jira-123-auth-worker');
    });
  });

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
