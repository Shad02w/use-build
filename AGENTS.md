# AGENTS Guide: use-build

This file is for coding agents working in this repository.
It documents how to build, lint, test, and how to follow local code style.

## Project Intent

- `use-build` is a plugin library for Vite and Rsbuild.
- Files containing the `"use build"` directive are executed at build time.
- Their exported values are serialized into runtime-safe static exports.
- Main package: `core/` (published as `use-build`).
- Test fixtures: `test/basic-react`, `test/vite-6-react`, `test/vite-7-react`.

## Workspace Layout

- Root workspace: `/` (`pnpm-workspace.yaml` includes `core` and `test/*`).
- Publishable package: `core/`.
- Fixture apps used as integration tests: `test/*`.
- Release/test automation: `.github/workflows/*.yml`.
- Helper scripts for publish flow: `scripts/prepublish-core.mjs`, `scripts/cleanup-core.mjs`.

## Tooling and Runtime

- Package manager in repo: `pnpm` (`packageManager: pnpm@10.6.5`).
- CI uses Node `22`.
- Repo is ESM-first (`"type": "module"` in root and core).
- TypeScript is strict (see `tsconfig.base.json` and `core/tsconfig.json`).
- Formatting is Prettier-driven (`.prettierrc`).

## Package Management Rules

- Prefer `@antfu/ni` wrappers when possible:
    - Install deps: `nci`
    - Run scripts: `nr <script>`
- Canonical commands in this guide are shown with `pnpm` because CI uses `pnpm`.
- Do not switch package manager or regenerate lockfiles with other tools.

## Install Commands

- Install all dependencies (CI-compatible):
    - `pnpm install --frozen-lockfile`
- Local install (if lockfile updates are acceptable):
    - `pnpm install`

## Build Commands

- Build the publishable plugin package:
    - `pnpm --filter use-build build`
    - Equivalent from root: `pnpm -C core build`
- Watch build while developing core:
    - `pnpm -C core dev`
- Build all integration fixtures through core test script:
    - `pnpm --filter use-build test`

## Test Commands

Important: there is no unit test runner configured (no Vitest/Jest here).
"Tests" are integration fixture builds.

- Run all integration tests:
    - `pnpm --filter use-build test`
- Run a single fixture test (recommended pattern):
    - `pnpm -C test/basic-react build`
    - `pnpm -C test/vite-6-react build`
    - `pnpm -C test/vite-7-react build`
- CI currently runs:
    - core build
    - `test/basic-react` build
    - `test/vite-6-react` build

## Lint / Format / Typecheck Commands

- Lint is configured only in Vite fixtures via package scripts:
    - `pnpm -C test/vite-6-react lint`
    - `pnpm -C test/vite-7-react lint`
- No root lint script and no core lint script currently.
- Formatting (manual):
    - `pnpm prettier -w .`
- Format check:
    - `pnpm prettier -c .`
- Type-check examples:
    - Vite fixtures: `pnpm -C test/vite-6-react build` (runs `tsc -b && vite build`)
    - Core: `pnpm -C core build` (generates types via rslib)

## Code Style: Formatting

From `.prettierrc`:

- Indent with 4 spaces.
- No semicolons.
- Use double quotes.
- No trailing commas.
- `printWidth` is 140.
- `arrowParens` is `avoid`.
- YAML files use 2-space indentation.

## Code Style: Imports

- Prefer ESM imports/exports.
- Use `import type` for type-only imports.
- Use `node:` prefix for Node built-ins (for example `node:path`, `node:net`).
- Keep external imports above internal relative imports.
- Prefer explicit named imports over namespace imports unless needed.
- Use dynamic `await import(...)` only when it is intentional (lazy/optional/runtime-only).

## Code Style: Types and TS Safety

- Keep strict typing standards; do not relax `strict` settings.
- Avoid `any`; if unavoidable, keep it narrow and localized.
- Prefer `unknown` in catch flows and narrow with `instanceof Error`.
- Preserve `noUnusedLocals` and `noUnusedParameters` expectations.
- Use precise return types on exported APIs when clarity helps.

## Code Style: Naming and Exports

- `PascalCase`: classes, React components, plugin factory with public API style (`UseBuildPlugin`).
- `camelCase`: variables, functions, helpers.
- `UPPER_SNAKE_CASE`: constants used as markers/identifiers.
- Use descriptive names for plugin/runtime concepts (`fileSet`, `resourcePath`, `handler`).
- In core library files, prefer named exports for library APIs and helpers.
- Keep file names consistent with existing style (`kebab-case` for multi-word utility files).

## Error Handling Guidelines

- Fail fast with explicit guard clauses.
- Throw `Error` with actionable context (path, url, module id, operation).
- Prefix user-facing plugin errors with `[use-build]` where appropriate.
- In `catch`, preserve original message when possible.
- Only swallow errors intentionally (for cleanup/no-op paths) and keep scope minimal.

## `"use build"` Directive Rules

- Build-time files must include the exact string directive `"use build"`.
- The directive must be discoverable as a real module directive (AST checked).
- Only serializable exports are supported at runtime output.
- Unsupported export value types include `function`, `symbol`, and `bigint`.
- Cyclic/non-JSON-serializable structures will fail serialization.

## Rsbuild/Vite Plugin-Specific Notes

- Vite plugin entry: `core/src/vite.ts` (`UseBuildPlugin`).
- Rsbuild plugin entry: `core/src/rsbuildv2/index.ts` (`pluginUseBuild`).
- Runtime server code is in `core/src/rsbuildv2/server.ts`.
- Virtual module implementation is in `core/src/rsbuildv2/virtual-module.ts`.
- Keep cross-platform path handling intact (Windows path normalization is required).

## Agent Working Rules for This Repo

- Prefer minimal, focused diffs.
- Do not edit generated output in `core/dist/*` manually unless task explicitly requires it.
- If changing behavior in `core/src/*`, validate with at least one fixture build.
- For broad changes, run all integration fixture builds.
- Update docs when public behavior or configuration changes.

## Cursor/Copilot Rules Check

- `.cursorrules`: not found.
- `.cursor/rules/`: not found.
- `.github/copilot-instructions.md`: not found.
- If these files are added later, treat them as highest-priority agent instructions.

## Quick Command Cheat Sheet

- Install: `pnpm install --frozen-lockfile`
- Build core: `pnpm -C core build`
- Watch core: `pnpm -C core dev`
- Test all fixtures: `pnpm --filter use-build test`
- Test single fixture: `pnpm -C test/vite-6-react build`
- Lint fixture: `pnpm -C test/vite-6-react lint`
- Format write: `pnpm prettier -w .`
- Format check: `pnpm prettier -c .`
