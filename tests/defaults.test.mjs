import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deepMerge, applyDefaults, getRepoInfoFromEnv } from '../lib/defaults.mjs';
import { existsSync } from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('defaults', () => {
  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const defaults = { a: 1, b: 2 };
      const overrides = { b: 3, c: 4 };
      expect(deepMerge(defaults, overrides)).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deeply merge nested objects', () => {
      const defaults = { a: { b: 1, c: 2 }, d: 3 };
      const overrides = { a: { c: 5 } };
      expect(deepMerge(defaults, overrides)).toEqual({ a: { b: 1, c: 5 }, d: 3 });
    });

    it('should replace arrays instead of merging them', () => {
      const defaults = { arr: [1, 2, 3] };
      const overrides = { arr: [4, 5] };
      expect(deepMerge(defaults, overrides)).toEqual({ arr: [4, 5] });
    });

    it('should handle empty overrides', () => {
      const defaults = { a: 1, b: { c: 2 } };
      const overrides = {};
      expect(deepMerge(defaults, overrides)).toEqual({ a: 1, b: { c: 2 } });
    });

    it('should handle empty defaults', () => {
      const defaults = {};
      const overrides = { a: 1, b: { c: 2 } };
      expect(deepMerge(defaults, overrides)).toEqual({ a: 1, b: { c: 2 } });
    });

    it('should handle nested objects with new keys', () => {
      const defaults = { a: { b: 1 } };
      const overrides = { a: { c: 2 } };
      expect(deepMerge(defaults, overrides)).toEqual({ a: { b: 1, c: 2 } });
    });

    it('should handle null values in overrides', () => {
      const defaults = { a: 1, b: 2 };
      const overrides = { a: null };
      expect(deepMerge(defaults, overrides)).toEqual({ a: null, b: 2 });
    });
  });

  describe('applyDefaults', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      existsSync.mockReturnValue(false);
    });

    it('should apply default production_branch', () => {
      const config = { name: 'my-app' };
      const result = applyDefaults(config, '/working/dir');
      expect(result.production_branch).toBe('main');
    });

    it('should apply default build config', () => {
      const config = { name: 'my-app' };
      const result = applyDefaults(config, '/working/dir');
      expect(result.build).toEqual({
        command: 'npm run build',
        output: 'dist',
        root: '',
      });
    });

    it('should apply default preview config', () => {
      const config = { name: 'my-app' };
      const result = applyDefaults(config, '/working/dir');
      expect(result.preview).toEqual({
        branches: ['*'],
        exclude: [],
      });
    });

    it('should preserve user overrides', () => {
      const config = {
        name: 'my-app',
        production_branch: 'master',
        build: { command: 'yarn build', output: 'build' },
      };
      const result = applyDefaults(config, '/working/dir');
      expect(result.production_branch).toBe('master');
      expect(result.build.command).toBe('yarn build');
      expect(result.build.output).toBe('build');
      expect(result.build.root).toBe(''); // default applied
    });

    it('should auto-detect repo from options', () => {
      const config = { name: 'my-app' };
      const result = applyDefaults(config, '/working/dir', {
        repoOwner: 'myorg',
        repoName: 'myrepo',
      });
      expect(result.repo).toEqual({ owner: 'myorg', name: 'myrepo' });
    });

    it('should not override explicit repo config', () => {
      const config = {
        name: 'my-app',
        repo: { owner: 'explicit-owner', name: 'explicit-repo' },
      };
      const result = applyDefaults(config, '/working/dir', {
        repoOwner: 'myorg',
        repoName: 'myrepo',
      });
      expect(result.repo).toEqual({ owner: 'explicit-owner', name: 'explicit-repo' });
    });

    it('should auto-detect worker folder', () => {
      existsSync.mockReturnValue(true);
      const config = { name: 'my-app' };
      const result = applyDefaults(config, '/working/dir');
      expect(result.worker).toBeDefined();
      expect(result.worker.main).toBe('worker/worker.js');
    });

    it('should not add worker config if folder does not exist', () => {
      existsSync.mockReturnValue(false);
      const config = { name: 'my-app' };
      const result = applyDefaults(config, '/working/dir');
      expect(result.worker).toBeUndefined();
    });

    it('should apply worker defaults when worker config is provided', () => {
      const config = {
        name: 'my-app',
        worker: { main: 'custom/worker.js' },
      };
      const result = applyDefaults(config, '/working/dir');
      expect(result.worker.main).toBe('custom/worker.js');
      expect(result.worker.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getRepoInfoFromEnv', () => {
    afterEach(() => {
      delete process.env.GITHUB_REPOSITORY;
    });

    it('should parse GITHUB_REPOSITORY correctly', () => {
      process.env.GITHUB_REPOSITORY = 'myorg/myrepo';
      const result = getRepoInfoFromEnv();
      expect(result).toEqual({ repoOwner: 'myorg', repoName: 'myrepo' });
    });

    it('should return null if GITHUB_REPOSITORY is not set', () => {
      delete process.env.GITHUB_REPOSITORY;
      const result = getRepoInfoFromEnv();
      expect(result).toBeNull();
    });

    it('should handle repos with hyphens', () => {
      process.env.GITHUB_REPOSITORY = 'my-org/my-repo-name';
      const result = getRepoInfoFromEnv();
      expect(result).toEqual({ repoOwner: 'my-org', repoName: 'my-repo-name' });
    });
  });
});
