# Dependency Version Uplift Check

A GitHub Action that detects and reports dependency version changes in Pull Requests across multiple ecosystems.

## Features

- 🔍 **Multi-ecosystem support**: Node.js, Python, Go, Ruby, Java/Gradle/Maven, Rust, and .NET
- 📊 **Smart version comparison**: Detects major, minor, patch, and prerelease changes
- 💬 **PR Comments**: Automatically posts a formatted comment with all version changes
- 🏷️ **Semver categorization**: Changes are labeled by severity (🔴 major, 🟡 minor, 🟢 patch)
- 📦 **Lock file support**: Analyzes both manifest and lock files

## Supported Ecosystems & Files

| Ecosystem | Manifest Files | Lock Files |
|-----------|---------------|------------|
| **Node.js** | `package.json` | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| **Python** | `requirements.txt`, `pyproject.toml`, `Pipfile` | `poetry.lock`, `Pipfile.lock` |
| **Go** | `go.mod` | `go.sum` |
| **Ruby** | `Gemfile` | `Gemfile.lock` |
| **Java** | `pom.xml`, `build.gradle`, `build.gradle.kts` | - |
| **Rust** | `Cargo.toml` | `Cargo.lock` |
| **.NET** | `*.csproj`, `*.fsproj`, `*.vbproj`, `packages.config` | - |

## Usage

### Basic Usage

```yaml
name: Dependency Version Check

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  check-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 #v6.0.1
        with:
          fetch-depth: 0  # Required for git diff
      - uses: chrisw-dev/contains-version-uplift@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

### With Custom Configuration

```yaml
- uses: chrisw-dev/contains-version-uplift@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    ecosystems: 'node,python'  # Only check specific ecosystems
    comment-on-pr: 'true'
    include-dev-dependencies: 'true'
```

### Using Outputs

```yaml
- uses: chrisw-dev/contains-version-uplift@v1
  id: deps-check
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Check for major updates
  if: steps.deps-check.outputs.has-changes == 'true'
  run: |
    echo "Found ${{ steps.deps-check.outputs.changes-count }} dependency changes"
    echo "Changes: ${{ steps.deps-check.outputs.changes-json }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | GitHub token for API access (used for PR comments) | No | `${{ github.token }}` |
| `ecosystems` | Comma-separated list of ecosystems to check. Options: `node`, `python`, `go`, `ruby`, `java`, `rust`, `dotnet`. Use `all` for all ecosystems. | No | `all` |
| `comment-on-pr` | Whether to post a comment on the PR with the results | No | `true` |
| `include-dev-dependencies` | Whether to include dev/test dependencies in the check | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `has-changes` | Boolean indicating whether any dependency version changes were detected |
| `changes-json` | JSON string containing all detected dependency changes |
| `changes-count` | Total number of dependency changes detected |

## Example PR Comment

When dependency changes are detected, the action posts a comment like this:

---

## 📦 Dependency Version Changes

This pull request contains **5** dependency version changes.

### 📦 Node.js / npm

| Package | Previous | New | Change |
|---------|----------|-----|--------|
| `@types/node` | 18.0.0 | 20.0.0 | 🔴 Major |
| `typescript` | 5.2.0 | 5.3.0 | 🟡 Minor |
| `lodash` | 4.17.20 | 4.17.21 | 🟢 Patch |

### 🐍 Python

| Package | Previous | New | Change |
|---------|----------|-----|--------|
| `requests` | _new_ | 2.31.0 | ➕ Added |
| `flask` | 2.0.0 | _removed_ | ➖ Removed |

### Summary

🔴 1 major | 🟡 1 minor | 🟢 1 patch | ➕ 1 added | ➖ 1 removed

---

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build    # Compile TypeScript
npm run bundle   # Build dist/index.js
```

### Test

```bash
npm test
```

### Lint & Format

```bash
npm run lint
npm run format
```

### All Development Commands

```bash
make help    # Show all available commands
make all     # Run lint, test, and bundle
```

## Release Process

This project uses a tag-triggered release workflow.

### Creating a Release

The easiest way to create a release is using the Makefile:

```bash
make release VERSION=1.0.0
```

This command will:
1. ✅ Verify you're on the main branch
2. ✅ Check for uncommitted changes
3. ✅ Run tests
4. ✅ Build the `dist/` bundle
5. ✅ Update `package.json` version
6. ✅ Create and push the version tag
7. ✅ Trigger the GitHub Actions release workflow

### Manual Release

If you prefer to release manually:

```bash
# 1. Ensure all changes are committed
git status

# 2. Run tests and build
npm test
npm run bundle

# 3. Commit dist/ if changed
git add dist/
git commit -m "chore: build dist for v1.0.0"

# 4. Update package.json version
npm version 1.0.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version to 1.0.0"

# 5. Create and push tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
```

### What Happens on Release

When you push a version tag (e.g., `v1.0.0`), GitHub Actions will:
1. Run tests
2. Build and commit `dist/` to the tag
3. Update floating version tags (`v1`, `v1.0`)
4. Create a GitHub Release with auto-generated release notes

### Version Tags

After release, users can reference your action with:
- `@v1.0.0` - Pinned to exact version
- `@v1.0` - Latest patch in v1.0.x (e.g., v1.0.3)
- `@v1` - Latest version in v1.x.x (recommended)

## License

MIT
