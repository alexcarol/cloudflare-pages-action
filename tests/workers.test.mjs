import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildBindings, syncWorker } from '../lib/workers.mjs';
import { readFileSync } from 'fs';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('workers', () => {
  describe('buildBindings', () => {
    it('should return empty array when no bindings configured', () => {
      expect(buildBindings(null, null)).toEqual([]);
      expect(buildBindings(undefined, undefined)).toEqual([]);
      expect(buildBindings({}, null)).toEqual([]);
    });

    it('should convert environment variables to plain_text bindings', () => {
      const bindingsConfig = {
        environment_variables: {
          API_URL: 'https://api.example.com',
          DEBUG: 'true',
        },
      };
      const result = buildBindings(bindingsConfig, null);
      expect(result).toEqual([
        { name: 'API_URL', type: 'plain_text', text: 'https://api.example.com' },
        { name: 'DEBUG', type: 'plain_text', text: 'true' },
      ]);
    });

    it('should convert secrets to secret_text bindings', () => {
      const secrets = {
        API_KEY: 'secret-key-123',
        DATABASE_URL: 'postgres://...',
      };
      const result = buildBindings(null, secrets);
      expect(result).toEqual([
        { name: 'API_KEY', type: 'secret_text', text: 'secret-key-123' },
        { name: 'DATABASE_URL', type: 'secret_text', text: 'postgres://...' },
      ]);
    });

    it('should convert KV namespaces', () => {
      const bindingsConfig = {
        kv_namespaces: [
          { binding: 'KV_CACHE', id: 'kv-namespace-id-1' },
          { binding: 'KV_SESSIONS', id: 'kv-namespace-id-2' },
        ],
      };
      const result = buildBindings(bindingsConfig, null);
      expect(result).toEqual([
        { name: 'KV_CACHE', type: 'kv_namespace', namespace_id: 'kv-namespace-id-1' },
        { name: 'KV_SESSIONS', type: 'kv_namespace', namespace_id: 'kv-namespace-id-2' },
      ]);
    });

    it('should convert D1 databases', () => {
      const bindingsConfig = {
        d1_databases: [
          { binding: 'DB', database_id: 'd1-db-id-1' },
        ],
      };
      const result = buildBindings(bindingsConfig, null);
      expect(result).toEqual([
        { name: 'DB', type: 'd1', id: 'd1-db-id-1' },
      ]);
    });

    it('should convert R2 buckets', () => {
      const bindingsConfig = {
        r2_buckets: [
          { binding: 'STORAGE', bucket_name: 'my-bucket' },
        ],
      };
      const result = buildBindings(bindingsConfig, null);
      expect(result).toEqual([
        { name: 'STORAGE', type: 'r2_bucket', bucket_name: 'my-bucket' },
      ]);
    });

    it('should handle all binding types together', () => {
      const bindingsConfig = {
        environment_variables: { ENV: 'production' },
        kv_namespaces: [{ binding: 'KV', id: 'kv-id' }],
        d1_databases: [{ binding: 'DB', database_id: 'db-id' }],
        r2_buckets: [{ binding: 'R2', bucket_name: 'bucket' }],
      };
      const secrets = { SECRET: 'secret-value' };

      const result = buildBindings(bindingsConfig, secrets);
      expect(result).toHaveLength(5);
      expect(result).toContainEqual({ name: 'ENV', type: 'plain_text', text: 'production' });
      expect(result).toContainEqual({ name: 'SECRET', type: 'secret_text', text: 'secret-value' });
      expect(result).toContainEqual({ name: 'KV', type: 'kv_namespace', namespace_id: 'kv-id' });
      expect(result).toContainEqual({ name: 'DB', type: 'd1', id: 'db-id' });
      expect(result).toContainEqual({ name: 'R2', type: 'r2_bucket', bucket_name: 'bucket' });
    });

    it('should convert numeric values to strings', () => {
      const bindingsConfig = {
        environment_variables: {
          PORT: 3000,
          TIMEOUT: 5000,
        },
      };
      const result = buildBindings(bindingsConfig, null);
      expect(result).toEqual([
        { name: 'PORT', type: 'plain_text', text: '3000' },
        { name: 'TIMEOUT', type: 'plain_text', text: '5000' },
      ]);
    });
  });

  describe('syncWorker', () => {
    let mockClient;

    beforeEach(() => {
      vi.resetAllMocks();
      mockClient = {
        workers: {
          scripts: {
            update: vi.fn().mockResolvedValue({}),
          },
          subdomains: {
            get: vi.fn().mockResolvedValue({ subdomain: 'myaccount' }),
          },
        },
      };
      readFileSync.mockReturnValue('export default { fetch() { return new Response("Hello"); } }');
    });

    afterEach(() => {
      delete process.env.GITHUB_OUTPUT;
    });

    it('should return null if no worker configuration', async () => {
      const config = { name: 'my-app', production_branch: 'main' };
      const result = await syncWorker(mockClient, 'account-id', config, 'main', null, '/working');
      expect(result).toBeNull();
      expect(mockClient.workers.scripts.update).not.toHaveBeenCalled();
    });

    it('should skip preview deployment when deploy_previews is false', async () => {
      const config = {
        name: 'my-app',
        production_branch: 'main',
        worker: { name: 'my-worker', main: 'worker/worker.js', deploy_previews: false },
      };
      const result = await syncWorker(mockClient, 'account-id', config, 'feature/auth', null, '/working');
      expect(result).toBeNull();
      expect(mockClient.workers.scripts.update).not.toHaveBeenCalled();
    });

    it('should deploy to production with base worker name', async () => {
      const config = {
        name: 'my-app',
        production_branch: 'main',
        worker: {
          name: 'my-worker',
          main: 'worker/worker.js',
          compatibility_date: '2024-01-01',
        },
      };
      const result = await syncWorker(mockClient, 'account-id', config, 'main', null, '/working');

      expect(result).toEqual({
        workerName: 'my-app',
        workerUrl: 'https://my-app.myaccount.workers.dev',
      });
      expect(mockClient.workers.scripts.update).toHaveBeenCalledWith('my-app', expect.any(Object));
    });

    it('should deploy to preview with branch-prefixed worker name', async () => {
      const config = {
        name: 'my-app',
        production_branch: 'main',
        worker: {
          name: 'my-worker',
          main: 'worker/worker.js',
          compatibility_date: '2024-01-01',
        },
      };
      const result = await syncWorker(mockClient, 'account-id', config, 'feature/auth', null, '/working');

      expect(result).toEqual({
        workerName: 'feature-auth-my-app',
        workerUrl: 'https://feature-auth-my-app.myaccount.workers.dev',
      });
      expect(mockClient.workers.scripts.update).toHaveBeenCalledWith('feature-auth-my-app', expect.any(Object));
    });

    it('should include bindings in deployment', async () => {
      const config = {
        name: 'my-app',
        production_branch: 'main',
        worker: {
          name: 'my-worker',
          main: 'worker/worker.js',
          compatibility_date: '2024-01-01',
          bindings: {
            environment_variables: { API_URL: 'https://api.example.com' },
          },
        },
      };
      const secrets = { API_KEY: 'secret-123' };

      await syncWorker(mockClient, 'account-id', config, 'main', secrets, '/working');

      expect(mockClient.workers.scripts.update).toHaveBeenCalledWith(
        'my-app',
        expect.objectContaining({
          metadata: expect.objectContaining({
            bindings: expect.arrayContaining([
              { name: 'API_URL', type: 'plain_text', text: 'https://api.example.com' },
              { name: 'API_KEY', type: 'secret_text', text: 'secret-123' },
            ]),
          }),
        })
      );
    });

    it('should throw error if worker script cannot be read', async () => {
      readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const config = {
        name: 'my-app',
        production_branch: 'main',
        worker: {
          name: 'my-worker',
          main: 'worker/worker.js',
          compatibility_date: '2024-01-01',
        },
      };

      await expect(syncWorker(mockClient, 'account-id', config, 'main', null, '/working'))
        .rejects.toThrow('ENOENT');
    });
  });
});
