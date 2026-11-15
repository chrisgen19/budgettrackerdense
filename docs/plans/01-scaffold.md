# 01 Scaffold

Goal: an empty Next 16 app that boots, with lint, type-check and tests wired. No database yet.

## Steps
1. Branch: `git checkout -b feature/scaffold` (the repo is `git init`ed with no commits; make the
   first commit on `main` with just `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `docs/`,
   `design-reference/README.md` if you want a clean base, then branch).
2. Create the app in place:
   `pnpm create next-app@latest . --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-pnpm`
   - It must not overwrite `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `docs/`, `design-reference/`.
     If the CLI refuses a non-empty folder, scaffold into a temp folder and move the files in.
   - Confirm what was installed: read `node_modules/next/package.json`, the Tailwind version, and
     Next's bundled docs for `proxy.ts`, caching and `params` being async. Do not rely on memory.
3. Pin Node 24: `"engines": { "node": ">=24" }` and `.nvmrc` with `24`.
4. Scripts in `package.json`:
   ```json
   {
     "dev": "next dev -H 127.0.0.1 -p 3200",
     "build": "prisma generate && next build",
     "start": "next start -p 3200",
     "lint": "eslint . --max-warnings 0",
     "type-check": "tsc --noEmit",
     "test": "vitest run",
     "test:watch": "vitest"
   }
   ```
   `build` must never contain `migrate`. Plan 02 adds `sync:schema`, plan 03 adds `sync:vendor`
   and `check:drift`.
5. `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, paths
   `"@/*": ["./src/*"]` and `"@bt/*": ["./src/vendor/bt/*"]` (used from plan 03).
6. Vitest: `vitest.config.mts` with `environment: "node"` by default, `jsdom` per-file
   (`// @vitest-environment jsdom`) for component tests. Import `describe/it/expect` explicitly.
7. Strip the create-next-app demo page to a plain "Dense" placeholder.

## Dependencies
Approved by the stack decision (install in this phase or the one that first needs them):

| Package | Why | Phase |
|---|---|---|
| `next`, `react`, `react-dom`, `typescript`, `tailwindcss` 4, `eslint` | scaffold | 01 |
| `prisma`, `@prisma/client` **6.x** (match budgettracker's lockfile, currently 6.19.2) | DB | 02 |
| `zod` **3.x** (match budgettracker) | vendored validations | 03 |
| `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react` | tests | 01 |
| `tsx` (dev) | sync and drift scripts | 02 |
| `lucide-react` | icons | 05 |

Ask Christian before adding anything else. Plan 04 lists `bcryptjs` and `jose` for approval.

## Acceptance
- `pnpm dev` serves `http://127.0.0.1:3200` with the placeholder.
- `pnpm lint`, `pnpm type-check`, `pnpm test` (one trivial test) all pass.
- `pnpm build` succeeds and its script contains no `migrate`.
