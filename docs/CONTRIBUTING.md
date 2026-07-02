# Contributing to the Firefly Network

Thank you for your interest in contributing to the Firefly Network. This document provides guidelines for contributing to the project.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). By participating, you agree to uphold a welcoming and inclusive environment.

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **pnpm** 8+ (package manager)
- **Git** (version control)

### Setup

```bash
# Clone the repository
git clone https://github.com/paritytech/firefly-community.git
cd firefly-community

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run all checks before committing
pnpm check
```

### Project Structure

```
cocuyo/
├── apps/web/         # Next.js web application
├── packages/
│   ├── bulletin/        # Bulletin Chain client
│   ├── contracts/       # Solidity smart contracts (Hardhat)
│   ├── identity/        # DIM identity integration
│   ├── individuality/   # Proof-of-personhood + DotNS directory
│   ├── network-config/  # Single network registry (addresses, RPC, chain ids)
│   ├── types/           # Shared TypeScript types
│   └── ui/              # Shared UI component library
└── docs/                # Documentation
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:

- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Test additions or fixes
- `chore/` — Build/tooling changes

### 2. Make Changes

Follow the coding standards outlined in [CLAUDE.md](../CLAUDE.md):

- **TypeScript strict mode** — No `any`, no type assertions without justification
- **Explicit return types** — All exported functions must have typed returns
- **Co-located tests** — Tests live alongside the code they test
- **Minimal comments** — Code should be self-documenting; comment _why_, not _what_

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Type check
pnpm typecheck

# Lint
pnpm lint
```

### 4. Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add signal filtering by topic"
git commit -m "fix: correct timestamp display in SignalCard"
git commit -m "docs: update architecture documentation"
```

Commit message format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`, `perf`

### 5. Submit a Pull Request

1. Push your branch to GitHub
2. Create a Pull Request against `main`
3. Fill out the PR template
4. Wait for CI checks to pass
5. Request review

## Pull Request Guidelines

### PR Title

Use the same format as commit messages:

```
feat(ui): add VerificationBadge component
fix(services): correct pagination offset calculation
```

### PR Description

Include:

- **Summary** — What does this PR do? (1-3 bullet points)
- **Test plan** — How can reviewers verify the changes?
- **Screenshots** — For UI changes, include before/after screenshots

### Review Process

- At least one approval required
- All CI checks must pass
- No merge conflicts
- Code follows project standards

## Coding Standards

### TypeScript

```typescript
// Good: Explicit types, no any
export function getSignal(id: SignalId): Promise<Signal | null> {
  // ...
}

// Bad: Implicit any, no return type
export function getSignal(id) {
  // ...
}
```

### React Components

```typescript
// Good: Co-located, typed props, explicit return
export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

export function Button({ variant = 'primary', children }: ButtonProps): ReactElement {
  // ...
}
```

### Testing

```typescript
describe('SignalCard', () => {
  describe('rendering', () => {
    it('renders signal content', () => {
      /* ... */
    });
    it('renders author pseudonym', () => {
      /* ... */
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      /* ... */
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels', () => {
      /* ... */
    });
  });
});
```

## What We're Looking For

### High Priority

- Security improvements
- Accessibility enhancements
- Performance optimizations
- Bug fixes
- Test coverage improvements

### Medium Priority

- Documentation improvements
- Code quality refactors
- Developer experience improvements

### Lower Priority

- New features (please discuss first)
- Major architectural changes (requires ADR)

## Architecture Decision Records

For significant architectural decisions, create an ADR in `docs/ADR/`:

```markdown
# ADR-NNN: Title

## Status

Proposed | Accepted | Deprecated | Superseded

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing?

## Consequences

What becomes easier or more difficult as a result?
```

## Security Considerations

This is a **surveillance-resistant platform**. All contributions must consider:

1. **No PII in logs** — Never log personally identifiable information
2. **No third-party tracking** — No analytics, pixels, or external tracking
3. **Minimal data collection** — Collect only what's necessary
4. **Defense in depth** — Multiple layers of security
5. **Fail secure** — If something breaks, fail toward privacy

If you discover a security vulnerability, please report it through Parity's security disclosure process and Bug Bounty program at https://parity.io/bug-bounty rather than opening a public issue.

## Getting Help

- **GitHub Issues** — Bug reports and feature requests
- **Discussions** — Questions and community discussion
- **CLAUDE.md** — Comprehensive development guidelines

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

_Thank you for helping illuminate the darkness._
