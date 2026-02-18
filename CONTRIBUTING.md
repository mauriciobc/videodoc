# Contributing to videodoc

Thank you for your interest in contributing to videodoc!

## Repository Structure

```
videodoc/
├── packages/
│   ├── core/                    # @videodoc/core - components and helpers
│   │   ├── src/components/      # Remotion components
│   │   ├── src/playwright/      # Playwright helpers
│   │   └── src/remotion/        # Theme and base composition
│   └── create-videodoc/         # CLI scaffolder
│       ├── bin/                 # CLI entry point
│       └── lib/                 # Scaffolding logic
└── .changeset/                  # Version management
```

## Development Setup

```bash
# Clone the repo
git clone https://github.com/mauriciobc/videodoc.git
cd videodoc

# Install dependencies
npm install

# Build packages
npm run build

# Run linter
npm run lint
```

## Working on Core Components

All components accept a `theme` prop with fallback to `defaultTheme`:

```jsx
export const MyComponent = ({ theme = defaultTheme }) => {
  // Never hardcode colors - always use theme tokens
};
```

Always export new components from:
- `packages/core/src/index.js` (main export)
- `packages/core/src/remotion/index.js` (if Remotion-specific)

## Testing the CLI Locally

```bash
# Link the CLI for local testing
cd packages/create-videodoc
npm link

# In a test project directory
create-videodoc init
```

## Versioning with Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning:

```bash
# Add a changeset
npx changeset

# Follow prompts to select packages and describe changes

# Version packages
npx changeset version

# Publish
npm run release
```

## Commit Conventions

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `refactor:` — Code refactoring
- `test:` — Test changes
- `chore:` — Build/tooling changes

Example: `feat: add ZoomIn component`

## Code Style

- ESM throughout (`"type": "module"`)
- No hardcoded values - use theme tokens
- Components should accept and respect `theme` prop
- Template files should never overwrite existing files

## Pull Request Process

1. Create a feature branch (`git checkout -b feat/my-feature`)
2. Make your changes with appropriate tests
3. Add a changeset (`npx changeset`)
4. Push to your fork and open a PR
5. Ensure CI passes

## Questions?

Open an issue for discussion before major changes.
