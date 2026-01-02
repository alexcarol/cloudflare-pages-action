# Cloudflare Pages & Workers Action

A GitHub Action that syncs your `cloudflare.json` configuration to Cloudflare Pages and Workers with GitHub integration. Supports branch-based preview deployments for both Pages and Workers.

## Features

- **Simple Configuration**: Minimal config with smart defaults - just specify your project name
- **Auto-detect Workers**: If a `worker/` folder exists, worker deployment is enabled automatically
- **Branch-based Previews**: Both Pages and Workers deploy branch-specific previews by default
- **Bindings Support**: Configure environment variables, secrets, KV, D1, and R2 bindings

## Quick Start

### Minimal Setup

1. Create `cloudflare.json` in your repo root:

```json
{
  "name": "my-project"
}
```

2. Add the workflow:

```yaml
- name: Deploy to Cloudflare
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
```

That's it! The action will:
- Build with `npm run build` and deploy from `dist/`
- Auto-detect and deploy any `worker/worker.js`
- Enable branch previews for both Pages and Workers

### With Worker Secrets

```yaml
- name: Deploy to Cloudflare
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
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

Create a `cloudflare.json` file in your repository root. Most fields are optional with sensible defaults.

### Minimal (with worker/ folder auto-detected)

```json
{
  "name": "my-project"
}
```

This is equivalent to the full configuration below when a `worker/` folder exists.

### Full Configuration (all defaults shown)

```json
{
  "name": "my-project",
  "production_branch": "main",
  "build": {
    "command": "npm run build",
    "output": "dist"
  },
  "worker": {
    "main": "worker/worker.js",
    "deploy_previews": true
  }
}
```

### With Worker Bindings

```json
{
  "name": "my-project",
  "worker": {
    "bindings": {
      "environment_variables": {
        "API_URL": "https://api.example.com"
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

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | - | Cloudflare Pages project name |
| `repo.owner` | string | No | Auto-detected | GitHub repository owner |
| `repo.name` | string | No | Auto-detected | GitHub repository name |
| `production_branch` | string | No | `"main"` | Branch for production deployments |
| `build.command` | string | No | `"npm run build"` | Build command for Pages |
| `build.output` | string | No | `"dist"` | Output directory for built files |
| `build.root` | string | No | `""` | Root directory for the build |
| `preview.branches` | string[] | No | `["*"]` | Branches to deploy previews for |
| `preview.exclude` | string[] | No | `[]` | Branches to exclude from previews |

### Worker Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `worker` | object | No | Auto-detected | Worker config (auto-enabled if `worker/` folder exists) |
| `worker.main` | string | No | `"worker/worker.js"` | Path to worker entry point |
| `worker.build_command` | string | No | - | Command to build the worker |
| `worker.compatibility_date` | string | No | Today's date | Workers runtime compatibility date |
| `worker.compatibility_flags` | string[] | No | `[]` | Workers runtime feature flags |
| `worker.deploy_previews` | boolean | No | `true` | Deploy branch-specific preview workers |
| `worker.bindings` | object | No | - | Worker bindings configuration |

### Worker Bindings

| Field | Type | Description |
|-------|------|-------------|
| `environment_variables` | object | Plain text environment variables (non-sensitive) |
| `kv_namespaces` | array | KV namespace bindings (`binding`, `id`) |
| `d1_databases` | array | D1 database bindings (`binding`, `database_id`) |
| `r2_buckets` | array | R2 bucket bindings (`binding`, `bucket_name`) |

Secrets should be passed via the `worker-secrets` action input, not in `cloudflare.json`.

## Branch-based Worker Naming

Workers use the same base name as the Pages project for consistency. For preview deployments, workers are named with a branch prefix:

| Branch | Worker Name |
|--------|-------------|
| `main` (production) | `my-project` |
| `feature/auth` | `feature-auth-my-project` |
| `fix/bug-123` | `fix-bug-123-my-project` |

Branch names are normalized: `/` becomes `-`, uppercase becomes lowercase.

## Accessing Branch Worker URLs

The action outputs the worker URL for use in subsequent steps. You can also access the branch-specific worker URL from your Pages deployment.

### Using Action Outputs

```yaml
- name: Deploy to Cloudflare
  id: deploy
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}

- name: Use Worker URL
  run: |
    echo "Worker URL: ${{ steps.deploy.outputs.worker-url }}"
    echo "Worker Name: ${{ steps.deploy.outputs.worker-name }}"
```

### From Your Pages Application

Since Pages builds happen on Cloudflare's infrastructure via GitHub integration, the worker URL must be determined at runtime. There are two approaches:

#### Option 1: Use CF_PAGES_BRANCH Environment Variable (Recommended)

Cloudflare Pages exposes the `CF_PAGES_BRANCH` environment variable during builds. Use this to construct the worker URL dynamically:

```javascript
// worker-config.js
const WORKER_SUBDOMAIN = 'your-subdomain'; // Your workers.dev subdomain
const PAGES_PROJECT_NAME = 'my-project'; // Same as the "name" field in cloudflare.json
const PRODUCTION_BRANCH = 'main';

function getWorkerUrl() {
  const branch = typeof process !== 'undefined'
    ? process.env.CF_PAGES_BRANCH
    : null;

  // Production: use Pages project name
  if (!branch || branch === PRODUCTION_BRANCH) {
    return `https://${PAGES_PROJECT_NAME}.${WORKER_SUBDOMAIN}.workers.dev`;
  }

  // Preview: use branch-prefixed worker name
  const normalizedBranch = branch.replace(/\//g, '-').toLowerCase();
  return `https://${normalizedBranch}-${PAGES_PROJECT_NAME}.${WORKER_SUBDOMAIN}.workers.dev`;
}

export const WORKER_URL = getWorkerUrl();
```

#### Option 2: Inline Worker URL in HTML

In your workflow, after deployment, inject the worker URL into your built HTML:

```yaml
- name: Deploy to Cloudflare
  id: deploy
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}

# Note: For GitHub-integrated Pages, builds happen on Cloudflare's side.
# The action outputs are available for PR comments, other integrations, etc.
- name: Comment PR with URLs
  if: github.event_name == 'pull_request'
  run: |
    echo "Worker URL for this branch: ${{ steps.deploy.outputs.worker-url }}"
```

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
          cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
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
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
    deploy-worker: 'false'
```

## Migrating from Direct Upload

If you have an existing Pages project created via Direct Upload (wrangler pages deploy), set `allow-recreate: true` to migrate to GitHub integration:

```yaml
- name: Deploy to Cloudflare
  uses: alexcarol/cloudflare-pages-action@v1
  with:
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
    allow-recreate: 'true'
```

**Warning**: This will delete and recreate the project, losing deployment history.

## Releasing (for maintainers)

### Development (v0.x.x) - Fully Automated

Every push to `main` automatically:
1. Runs tests
2. Creates a new patch release (`v0.1.0` → `v0.1.1` → `v0.1.2`...)
3. Updates the `v0` floating tag

During development, users can reference:
```yaml
uses: alexcarol/cloudflare-pages-action@v0  # Latest v0.x.x
```

### Stable Release (v1+)

When ready for stable release:

1. Go to **Releases** → **Create a new release**
2. Create tag `v1.0.0` (or `v1.1.0`, `v2.0.0`, etc.)
3. Click **Publish release**

The [release workflow](.github/workflows/release.yml) will automatically update the major version tag (`v1`) to point to this release.

### Breaking changes

For breaking changes, create a new major version (e.g., `v2.0.0`). The workflow will create a new `v2` tag automatically.

## License

MIT
