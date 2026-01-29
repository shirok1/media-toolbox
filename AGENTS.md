# Repository Guidelines

## Project Structure & Module Organization
- `src/main.tsx` boots the React app; `src/App.tsx` holds the top-level layout. Use the `@` alias (configured in `tsconfig.json`/`vite.config.ts`) for imports.
- UI primitives live in `src/components/ui` (e.g., `button.tsx`); share cross-cutting helpers in `src/lib`. Keep assets in `src/assets` and static files in `public/`.
- Styling relies on Tailwind v4 directives in `src/index.css`/`src/App.css`; prefer utility-first classes over ad-hoc CSS.
- Build config lives in `vite.config.ts`; formatting/lint rules in `biome.json`. Tailor new modules to match these conventions.

## Build, Test, and Development Commands
- Install deps with `bun install` (preferred; `bun.lock` checked in). `npm`/`pnpm` are possible but may drift from the lockfile.
- `bun run dev` — start Vite (defaults to port 5173); add `-- --host` to expose on LAN.
- `bun run build` — type-check via `tsc -b` then produce a production bundle in `dist/`.
- `bun run preview` — serve the built assets locally to verify the production build.
- `bun run check` — format + lint with Biome; run before returning to human action.

## Coding Style & Naming Conventions
- Biome enforces tabs for indentation and double quotes for strings; avoid `var`, unused vars, or implicit `any`.
- React components should be PascalCase and colocated with supporting styles/hooks; hooks start with `use`, utilities are camelCase.
- Favor functional components, minimal state, and Tailwind utility classes; extend shared primitives in `src/components/ui` instead of duplicating variants.
- Keep imports path-aliased (`@/components/...`) and organized (Biome auto-organizes).

## Testing Guidelines
- No automated tests are present yet; add unit/UI tests when introducing logic-heavy utilities or components.
- Prefer Vitest + React Testing Library colocated as `*.test.tsx` or in `__tests__` folders; aim to cover parsing/formatting helpers in `src/lib`.
- Until tests exist, at minimum run `bun run check` and `bun run build` before opening a PR to catch type and bundle regressions.

## Commit & Pull Request Guidelines
- Git history is minimal (`init`); use short, imperative messages with a clear scope (e.g., `feat: add download button`, `chore: tune biome rules`).
- Keep PRs focused; include a brief summary, testing commands run, and UI screenshots for visible changes. Link issues or tasks when applicable.
