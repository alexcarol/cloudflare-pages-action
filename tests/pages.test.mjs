import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncPages } from '../lib/pages.mjs';

vi.mock('fs', () => ({
  appendFileSync: vi.fn(),
}));

describe('pages', () => {
  let mockClient;
  let mockExit;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    vi.resetAllMocks();
    mockClient = {
      pages: {
        projects: {
          get: vi.fn(),
          create: vi.fn().mockResolvedValue({}),
          edit: vi.fn().mockResolvedValue({}),
          delete: vi.fn().mockResolvedValue({}),
        },
      },
    };
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete process.env.GITHUB_OUTPUT;
  });

  const baseConfig = {
    name: 'my-project',
    production_branch: 'main',
    repo: { owner: 'myorg', name: 'myrepo' },
    build: { command: 'npm run build', output: 'dist', root: '' },
    preview: { branches: ['*'], exclude: [] },
  };

  describe('when project does not exist', () => {
    beforeEach(() => {
      const error = new Error('Not Found');
      error.status = 404;
      mockClient.pages.projects.get.mockRejectedValue(error);
    });

    it('should create a new project with GitHub integration', async () => {
      const result = await syncPages(mockClient, 'account-id', baseConfig, false);

      expect(mockClient.pages.projects.create).toHaveBeenCalledWith({
        account_id: 'account-id',
        name: 'my-project',
        production_branch: 'main',
        source: {
          type: 'github',
          config: {
            owner: 'myorg',
            repo_name: 'myrepo',
            production_branch: 'main',
            deployments_enabled: true,
            production_deployments_enabled: true,
            preview_deployment_setting: 'all',
            preview_branch_includes: ['*'],
            preview_branch_excludes: [],
          },
        },
        build_config: {
          build_command: 'npm run build',
          destination_dir: 'dist',
          root_dir: '',
        },
      });
      expect(result).toEqual({ pagesUrl: 'https://my-project.pages.dev' });
    });
  });

  describe('when project exists with GitHub source', () => {
    beforeEach(() => {
      mockClient.pages.projects.get.mockResolvedValue({
        name: 'my-project',
        source: { type: 'github' },
      });
    });

    it('should update the existing project', async () => {
      const result = await syncPages(mockClient, 'account-id', baseConfig, false);

      expect(mockClient.pages.projects.edit).toHaveBeenCalledWith('my-project', {
        account_id: 'account-id',
        production_branch: 'main',
        source: expect.objectContaining({
          type: 'github',
        }),
        build_config: expect.any(Object),
        deployment_configs: {
          preview: {},
          production: {},
        },
      });
      expect(result).toEqual({ pagesUrl: 'https://my-project.pages.dev' });
    });
  });

  describe('when project exists as Direct Upload', () => {
    beforeEach(() => {
      mockClient.pages.projects.get.mockResolvedValue({
        name: 'my-project',
        source: { type: 'direct_upload' },
      });
    });

    it('should fail without allow-recreate flag', async () => {
      await expect(syncPages(mockClient, 'account-id', baseConfig, false))
        .rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockClient.pages.projects.delete).not.toHaveBeenCalled();
    });

    it('should delete and recreate with allow-recreate flag', async () => {
      const result = await syncPages(mockClient, 'account-id', baseConfig, true);

      expect(mockClient.pages.projects.delete).toHaveBeenCalledWith('my-project', {
        account_id: 'account-id',
      });
      expect(mockClient.pages.projects.create).toHaveBeenCalled();
      expect(result).toEqual({ pagesUrl: 'https://my-project.pages.dev' });
    });
  });

  describe('when project exists with no source type', () => {
    beforeEach(() => {
      mockClient.pages.projects.get.mockResolvedValue({
        name: 'my-project',
        source: null,
      });
    });

    it('should fail without allow-recreate flag', async () => {
      await expect(syncPages(mockClient, 'account-id', baseConfig, false))
        .rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should throw non-404 errors', async () => {
      const error = new Error('Server Error');
      error.status = 500;
      mockClient.pages.projects.get.mockRejectedValue(error);

      await expect(syncPages(mockClient, 'account-id', baseConfig, false))
        .rejects.toThrow('Server Error');
    });
  });

  describe('preview configuration', () => {
    beforeEach(() => {
      const error = new Error('Not Found');
      error.status = 404;
      mockClient.pages.projects.get.mockRejectedValue(error);
    });

    it('should pass custom preview branch configuration', async () => {
      const config = {
        ...baseConfig,
        preview: {
          branches: ['develop', 'staging'],
          exclude: ['dependabot/*'],
        },
      };

      await syncPages(mockClient, 'account-id', config, false);

      expect(mockClient.pages.projects.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({
            config: expect.objectContaining({
              preview_branch_includes: ['develop', 'staging'],
              preview_branch_excludes: ['dependabot/*'],
            }),
          }),
        })
      );
    });
  });

  describe('build configuration', () => {
    beforeEach(() => {
      const error = new Error('Not Found');
      error.status = 404;
      mockClient.pages.projects.get.mockRejectedValue(error);
    });

    it('should pass custom build configuration', async () => {
      const config = {
        ...baseConfig,
        build: {
          command: 'yarn build',
          output: 'build',
          root: 'packages/frontend',
        },
      };

      await syncPages(mockClient, 'account-id', config, false);

      expect(mockClient.pages.projects.create).toHaveBeenCalledWith(
        expect.objectContaining({
          build_config: {
            build_command: 'yarn build',
            destination_dir: 'build',
            root_dir: 'packages/frontend',
          },
        })
      );
    });

    it('should handle missing build config values', async () => {
      const config = {
        ...baseConfig,
        build: {},
      };

      await syncPages(mockClient, 'account-id', config, false);

      expect(mockClient.pages.projects.create).toHaveBeenCalledWith(
        expect.objectContaining({
          build_config: {
            build_command: '',
            destination_dir: '.',
            root_dir: '',
          },
        })
      );
    });
  });
});
