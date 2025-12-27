.PHONY: build test lint format bundle clean release help

# Default target
help:
	@echo "Available targets:"
	@echo "  make build     - Compile TypeScript"
	@echo "  make test      - Run tests"
	@echo "  make lint      - Run linter"
	@echo "  make format    - Format code"
	@echo "  make bundle    - Build dist/index.js"
	@echo "  make clean     - Remove build artifacts"
	@echo "  make release   - Create a new release (interactive)"
	@echo ""
	@echo "Release usage:"
	@echo "  make release VERSION=1.0.0"

# Build TypeScript
build:
	npm run build

# Run tests
test:
	npm test

# Run tests with coverage
test-coverage:
	npm run test:coverage

# Run linter
lint:
	npm run lint

# Format code
format:
	npm run format

# Check formatting
format-check:
	npm run format:check

# Build the distribution bundle
bundle:
	npm run bundle

# Clean build artifacts
clean:
	rm -rf lib/ dist/ coverage/

# Full build pipeline
all: lint test bundle

# Create a release
release:
ifndef VERSION
	@echo "Error: VERSION is required"
	@echo "Usage: make release VERSION=1.0.0"
	@exit 1
endif
	@echo "🚀 Creating release v$(VERSION)..."
	@echo ""
	@# Verify we're on main branch
	@BRANCH=$$(git branch --show-current); \
	if [ "$$BRANCH" != "main" ]; then \
		echo "⚠️  Warning: You're on branch '$$BRANCH', not 'main'"; \
		read -p "Continue anyway? [y/N] " confirm; \
		if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
			echo "Aborted."; \
			exit 1; \
		fi; \
	fi
	@# Check for uncommitted changes
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "❌ Error: You have uncommitted changes. Please commit or stash them first."; \
		git status --short; \
		exit 1; \
	fi
	@# Run tests
	@echo "📋 Running tests..."
	@npm test
	@# Build bundle
	@echo "📦 Building dist/..."
	@npm run bundle
	@# Check if dist changed
	@if [ -n "$$(git status --porcelain dist/)" ]; then \
		echo "📝 Committing updated dist/..."; \
		git add dist/; \
		git commit -m "chore: build dist for v$(VERSION)"; \
	fi
	@# Update package.json version
	@echo "📝 Updating package.json version to $(VERSION)..."
	@npm version $(VERSION) --no-git-tag-version --allow-same-version
	@if [ -n "$$(git status --porcelain package.json package-lock.json)" ]; then \
		git add package.json package-lock.json; \
		git commit -m "chore: bump version to $(VERSION)"; \
	fi
	@# Create and push tag
	@echo "🏷️  Creating tag v$(VERSION)..."
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@echo "⬆️  Pushing to origin..."
	@git push origin main
	@git push origin "v$(VERSION)"
	@echo ""
	@echo "✅ Release v$(VERSION) created and pushed!"
	@echo "🔗 GitHub Actions will now build and publish the release."
