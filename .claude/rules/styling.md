Global rules: [AGENTS.md](../../AGENTS.md). Claude stack summary: [CLAUDE.md](../CLAUDE.md).

# Rules — styling (NativeWind + theme tokens)

NativeWind is installed (`nativewind` + `tailwindcss`, config in `tailwind.config.js` / `global.css`) alongside the existing runtime theme system (`src/shared/theme/`). The two are **not interchangeable** — each owns a different concern.

## Division of responsibility

- **`useTheme()` / theme tokens** — the only source for semantic color (`background`, `surface`, `textPrimary`, `primary`, `danger`, …), because light/dark switching in this app is a runtime JS context (`ThemeProvider`), not a static class swap. There is no `dark:` Tailwind variant wired to it.
- **NativeWind `className`** — layout and spacing utilities: `flex-1`, `flex-row`, `items-center`, `justify-between`, `gap-2`, `p-4`, `mt-6`, `w-full`, `rounded-*` (only if not already a themed `radius` token), absolute positioning, `flex-wrap`, etc.

## Must
- Use `className` only for structural/layout utilities described above.
- Keep `StyleSheet.create()` + theme tokens for any color, typography, or elevation value — pull from `useTheme()`.
- New simple screens/components may use `className` for their outer layout instead of a `StyleSheet.create()` layout block, as long as colors still come from theme tokens (inline `style={{ color: theme.colors.textPrimary }}` or a small themed `StyleSheet`).
- Keep `tailwind.config.js` `theme.extend` empty of color definitions — colors are not Tailwind's job here.

## Must not
- Do not add color utility classes (`bg-blue-500`, `text-red-600`, arbitrary `bg-[#...]`, etc.) — these bypass `useTheme()` and will not react to light/dark mode.
- Do not reintroduce Styled Components or a second competing styling system.
- Do not use NativeWind for typography (`font-*`, `text-lg`, …) — typography tokens live in `src/shared/theme/tokens/typography.ts` / `fonts.ts`.
- Do not rewrite existing themed components to NativeWind just for the sake of it — this is additive, for new/simple layout code, not a migration.
