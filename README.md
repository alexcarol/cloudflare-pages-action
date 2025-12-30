# Cloudflare Pages & Workers Action

A GitHub Action that syncs your `cloudflare.json` configuration to Cloudflare Pages and Workers with GitHub integration. Supports branch-based preview deployments for both Pages and Workers.

## Features

- **Pages Configuration as Code**: Define your Cloudflare Pages project settings in `cloudflare.json`
- **Workers Deployment**: Deploy Cloudflare Workers alongside your Pages project
- **Branch-based Previews**: Automatically deploy branch-specific workers for preview environments
- **Bindings Support**: Configure environment variables, secrets, KV, D1, and R2 bindings

## Usage

### Basic Usage (Pages only)

```yaml
- name: Deploy to Cloudflare
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### With Workers

```yaml
- name: Deploy to Cloudflare
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    worker-secrets: |
      {
        "API_KEY": "${{ secrets.API_KEY }}",
        "DATABASE_URL": "${{ secrets.DATABASE_URL }}"
      }
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `cloudflare-api-token` | Cloudflare API token with Pages and Workers permissions | Yes | - |
| `cloudflare-account-id` | Cloudflare Account ID | Yes | - |
| `config-path` | Path to cloudflare.json config file | No | `cloudflare.json` |
| `allow-recreate` | Allow deleting and recreating Direct Upload projects for GitHub migration | No | `false` |
| `deploy-worker` | Whether to deploy worker. Set to `false` to skip worker deployment | No | `true` |
| `worker-secrets` | JSON object of worker secrets (key-value pairs) | No | `{}` |
| `branch` | Branch name for preview deployments. Auto-detected if not provided | No | Auto-detected |

## Outputs

| Output | Description |
|--------|-------------|
| `pages-url` | The Pages deployment URL (e.g., `https://my-project.pages.dev`) |
| `worker-url` | The Worker deployment URL |
| `worker-name` | The deployed worker name (may include branch prefix for previews) |

## Configuration

Create a `cloudflare.json` file in your repository root:

### Pages Only

```json
{
  "name": "my-project",
  "repo": {
    "owner": "your-username",
    "name": "your-repo"
  },
  "production_branch": "main",
  "build": {
    "command": "npm run build",
    "output": "dist",
    "root": ""
  },
  "preview": {
    "branches": ["*"],
    "exclude": []
  }
}
```

### Pages + Workers

```json
{
  "name": "my-project",
  "repo": {
    "owner": "your-username",
    "name": "your-repo"
  },
  "production_branch": "main",
  "build": {
    "command": "npm run build",
    "output": "dist",
    "root": ""
  },
  "worker": {
    "name": "my-worker",
    "main": "dist/worker.js",
    "build_command": "npm run build:worker",
    "compatibility_date": "2024-01-01",
    "deploy_previews": true,
    "bindings": {
      "environment_variables": {
        "API_URL": "https://api.example.com",
        "ENVIRONMENT": "production"
      },
      "kv_namespaces": [
        { "binding": "CACHE", "id": "your-kv-namespace-id" }
      ],
      "d1_databases": [
        { "binding": "DB", "database_id": "your-d1-database-id" }
      ],
      "r2_buckets": [
        { "binding": "STORAGE", "bucket_name": "your-bucket-name" }
      ]
    }
  }
}
```

## Configuration Reference

### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Cloudflare Pages project name |
| `repo.owner` | string | Yes | GitHub repository owner |
| `repo.name` | string | Yes | GitHub repository name |
| `production_branch` | string | Yes | Branch to use for production deployments |
| `build.command` | string | No | Build command for Pages |
| `build.output` | string | No | Output directory for built files |
| `build.root` | string | No | Root directory for the build |
| `preview.branches` | string[] | No | Branches to deploy previews for (default: `["*"]`) |
| `preview.exclude` | string[] | No | Branches to exclude from preview deployments |
| `allow_recreate` | boolean | No | Allow recreating Direct Upload projects |

### Worker Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `worker.name` | string | Yes | Base name for the worker |
| `worker.main` | string | Yes | Path to the worker entry point (bundled output) |
| `worker.build_command` | string | No | Command to build/bundle the worker |
| `worker.compatibility_date` | string | Yes | Workers runtime compatibility date |
| `worker.compatibility_flags` | string[] | No | Workers runtime feature flags |
| `worker.deploy_previews` | boolean | No | Deploy branch-specific workers for previews (default: `true`) |
| `worker.bindings` | object | No | Worker bindings configuration |

### Worker Bindings

| Field | Type | Description |
|-------|------|-------------|
| `environment_variables` | object | Plain text environment variables (non-sensitive) |
| `kv_namespaces` | array | KV namespace bindings (`binding`, `id`) |
| `d1_databases` | array | D1 database bindings (`binding`, `database_id`) |
| `r2_buckets` | array | R2 bucket bindings (`binding`, `bucket_name`) |

Secrets should be passed via the `worker-secrets` action input, not in `cloudflare.json`.

## Branch-based Worker Naming

For preview deployments, workers are named with a branch prefix:

| Branch | Worker Name |
|--------|-------------|
| `main` (production) | `my-worker` |
| `feature/auth` | `feature-auth-my-worker` |
| `fix/bug-123` | `fix-bug-123-my-worker` |

Branch names are normalized: `/` becomes `-`, uppercase becomes lowercase.

## API Token Permissions

Your Cloudflare API token needs the following permissions:

- **Account > Cloudflare Pages > Edit** - For Pages project management
- **Account > Workers Scripts > Edit** - For Workers deployment
- **Account > Workers KV Storage > Edit** - If using KV bindings
- **Account > D1 > Edit** - If using D1 bindings
- **Account > R2 > Edit** - If using R2 bindings

## Examples

### Full Workflow Example

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Deploy to Cloudflare
        id: deploy
        uses: alexcarol/cloudflare-pages-action@v1
        with:
          cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          worker-secrets: |
            {
              "API_KEY": "${{ secrets.API_KEY }}"
            }

      - name: Comment PR with URLs
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `Deployed to Cloudflare!\n\nPages: ${{ steps.deploy.outputs.pages-url }}\nWorker: ${{ steps.deploy.outputs.worker-url }}`
            })
```

### Skip Worker Deployment

```yaml
- name: Deploy Pages only
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    deploy-worker: 'false'
```

## Migrating from Direct Upload

If you have an existing Pages project created via Direct Upload (wrangler pages deploy), set `allow-recreate: true` to migrate to GitHub integration:

```yaml
- name: Deploy to Cloudflare
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    allow-recreate: 'true'
```

**Warning**: This will delete and recreate the project, losing deployment history.

## License

MIT
