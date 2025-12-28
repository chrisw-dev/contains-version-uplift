# Copilot Instructions

## Project Overview

**Dependency Version Uplift Check** is a GitHub Action that detects and reports dependency version changes in Pull Requests. It analyzes dependency files across multiple ecosystems and posts a formatted comment summarizing all version uplifts.

### Key Features
- Multi-ecosystem support: Node.js, Python, Go, Ruby, Java, Rust, .NET
- Semver-aware version comparison (major/minor/patch/prerelease)
- PR comment with formatted tables grouped by ecosystem
- Support for both manifest files and lock files
- Configurable ecosystem filtering and dev dependency inclusion

## Architecture

### Directory Structure
```
src/
├── index.ts          # Entry point (calls run())
├── main.ts           # Main orchestration logic
├── types.ts          # TypeScript types and VALID_ECOSYSTEMS constant
├── version.ts        # Version comparison utilities (semver)
├── comment.ts        # PR comment formatting and posting
└── parsers/
    ├── index.ts      # Parser registry and file pattern matching
    ├── node.ts       # package.json, package-lock.json, yarn.lock, pnpm-lock.yaml
    ├── python.ts     # requirements.txt, pyproject.toml, Pipfile, poetry.lock
    ├── go.ts         # go.mod, go.sum
    ├── ruby.ts       # Gemfile, Gemfile.lock
    ├── java.ts       # pom.xml, build.gradle, build.gradle.kts
    ├── rust.ts       # Cargo.toml, Cargo.lock
    └── dotnet.ts     # *.csproj, packages.config
```

### Key Design Decisions

1. **Single source of truth for ecosystems**: `VALID_ECOSYSTEMS` in `types.ts` defines all supported ecosystems. The `Ecosystem` type is derived from this array using `as const`.

2. **Parser pattern**: Each ecosystem has a parser module exporting functions that take file content (string) and return `ParsedDependencies[]`. Parsers are registered in `parsers/index.ts` with file patterns.

3. **Git-based diff**: The action uses `git diff` to find changed files, then `git show <ref>:<path>` to retrieve file contents at base and head commits. It does NOT receive diffs - it gets complete file contents.

4. **Security-first**: All parsers are defensive:
   - Input validation for ecosystems against whitelist
   - Path traversal prevention
   - Git ref format validation
   - File size limits (10MB max)
   - Safe YAML/TOML/JSON parsing with depth limits
   - XML XXE protection
   - Markdown output sanitization

5. **Deduplication**: When the same package appears in both manifest and lock files, prefer the manifest file version.

## Development Workflow

### Prerequisites
- Node.js (see `.node-version`)
- npm

### Setup
```bash
npm install
```

### Common Commands
```bash
make help          # Show all available commands
make test          # Run tests
make build         # Compile TypeScript
make bundle        # Build dist/index.js
make lint          # Run linter
make format        # Format code
make all           # lint + test + bundle
```

### Pre-commit Hook
Husky is configured to run tests and rebuild `dist/` before each commit. The hook:
1. Runs `npm test`
2. Runs `npm run bundle`
3. Stages `dist/` changes

To skip (emergency only): `git commit --no-verify`

### Testing
- All tests are in `__tests__/`
- Parser tests provide sample file content and verify extracted dependencies
- Use `npm test` or `make test`
- Coverage: `npm run test:coverage`

### Adding a New Ecosystem
1. Add ecosystem name to `VALID_ECOSYSTEMS` in `src/types.ts`
2. Create parser in `src/parsers/<ecosystem>.ts`
3. Register file patterns in `src/parsers/index.ts`
4. Add tests in `__tests__/parsers/<ecosystem>.test.ts`
5. Update README.md with supported files
6. Update action.yml description

## Release Process

### Using Make (Recommended)
```bash
make release VERSION=1.0.0
```

This automatically:
- Verifies you're on main branch
- Checks for uncommitted changes
- Runs tests
- Builds dist/
- Updates package.json version
- Creates and pushes version tag

### What Happens on Tag Push
GitHub Actions workflow (`.github/workflows/release.yml`):
1. Runs tests
2. Builds and commits dist/ to the tag
3. Updates floating tags (v1, v1.0)
4. Creates GitHub Release with auto-generated notes

### Version Tags
- `v1.0.0` - Exact version (created by you)
- `v1.0` - Updated automatically to latest v1.0.x
- `v1` - Updated automatically to latest v1.x.x

## Security Considerations

When modifying this codebase, maintain these security practices:

### Input Validation
- Validate ecosystem input against `VALID_ECOSYSTEMS` whitelist
- Validate file paths for path traversal (`..`, absolute paths, null bytes)
- Validate git refs match SHA-1 pattern (full 40-character or abbreviated 7+ character format)

### Parser Security
- Use safe YAML loading with `JSON_SCHEMA` (no custom tags)
- Check nesting depth before parsing JSON/TOML (max 20 levels)
- XML parsers use strict mode to prevent XXE
- Limit file sizes (10MB max)
- Limit dependency count per file (5000 max)
- Wrap all parsing in try-catch, return empty array on error

### Output Security
- Sanitize package names and versions before markdown output
- Escape backticks, pipes, brackets to prevent injection
- Strip HTML tags, escape HTML entities
- Truncate long names (256 chars) and versions (128 chars)

### Token Security
- Mask GitHub token with `core.setSecret()`

## Code Style

- TypeScript strict mode
- ESLint for linting
- Prettier for formatting
- Conventional commits encouraged (feat:, fix:, chore:, etc.)

## Dependencies

### Runtime (bundled in dist/)
- `@actions/core` - GitHub Actions toolkit
- `@actions/github` - GitHub API client
- `@actions/exec` - Command execution
- `semver` - Version comparison
- `js-yaml` - YAML parsing
- `toml` - TOML parsing
- `xml2js` - XML parsing

### Build
- TypeScript + Rollup for bundling
- Jest for testing
- Husky for git hooks

## Common Patterns

### Adding a Parser Function
```typescript
export function parseNewFormat(content: string): ParsedDependencies[] {
  try {
    // Validate/sanitize input first
    if (!checkNestingDepth(content, MAX_DEPTH)) {
      return [];
    }
    
    const deps = new Map<string, string>();
    // Parse logic here...
    
    if (deps.size === 0) {
      return [];
    }
    
    return [{ dependencies: deps, dependencyType: 'production' }];
  } catch {
    return []; // Always return empty on error, never throw
  }
}
```

### Test Pattern
```typescript
describe('parseNewFormat', () => {
  it('should parse dependencies', () => {
    const content = `...`;
    const result = parseNewFormat(content);
    
    expect(result).toHaveLength(1);
    expect(result[0].dependencyType).toBe('production');
    
    const deps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
    expect(deps?.dependencies.get('package-name')).toBe('1.0.0');
  });
});
```

## Troubleshooting

### TypeScript errors about missing modules
Restart TS server: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"

### Tests failing after parser changes
Ensure test imports use correct paths: `../../src/parsers/`

### dist/ out of sync error in CI
Run `npm run bundle` and commit the changes before pushing.
