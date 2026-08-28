---
globs: app/**, src/navigation/**
---

Global rules: [AGENTS.md](../../AGENTS.md). Claude stack summary: [CLAUDE.md](../CLAUDE.md).

# Rules — navigation

Navigation runs on **Expo Router** (file-based routing, `expo-router` ~6.x on Expo SDK 54) — not React Navigation directly, though Expo Router is built on top of it. Screens still live under `src/features/<feature>/screens/`; files under `app/` are thin re-export wrappers that wire a route path to a screen component (`export { default } from '@/features/<feature>/screens/X'`).

## Structure
- **`app/_layout.tsx`**: root layout. Holds the provider tree (see order below) and the root `<Stack>` with `Stack.Protected` groups gating onboarding / auth / main app.
- **`app/(tabs)/_layout.tsx`**: the bottom tab bar, via `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 54 API: `import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs'`). This is the **native system tab bar** — no custom floating/animated tab bar component.
- **Gate state:** `src/shared/stores/app-gate.store.ts` (Zustand) holds `onboardingDone` / `authed` booleans, initialized once from MMKV. `src/session/bootstrap.ts` exposes `completeOnboarding()`, `markAuthed()`, `markSignedOut()` — call these instead of navigating imperatively; `Stack.Protected` redirects automatically when the guard flips.
- **Routes:** a route *is* its file path under `app/` (e.g. `app/settings.tsx` → `/settings`, `app/(tabs)/home.tsx` → `/(tabs)/home`). There is no central `ROUTES` enum — reference paths as string literals (typed via `experiments.typedRoutes` in `app.json`).
- **Imperative navigation** outside a screen's own render (services, event handlers): `import { router } from 'expo-router'` → `router.push(...)`, `router.navigate(...)`, `router.replace(...)`, `router.back()`.

## Provider order (must match `app/_layout.tsx`)
```
i18n side-effect import  ← module-level, above the component
GestureHandlerRootView
  SafeAreaProvider
    ThemeProvider (app theme)
      ErrorBoundary
        QueryProvider
          AppShell:
            NavThemeProvider (@react-navigation/native Dark/DefaultTheme — avoids white flash on iOS 26)
            ThemedStatusBar
            OfflineBanner
            <Stack> with Stack.Protected groups
```

## Route gating (onboarding / auth / app)
```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Protected guard={!onboardingDone}>
    <Stack.Screen name="onboarding" />
  </Stack.Protected>
  <Stack.Protected guard={onboardingDone && !authed}>
    <Stack.Screen name="auth" />
  </Stack.Protected>
  <Stack.Protected guard={onboardingDone && authed}>
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="add-block" options={HALF_SHEET_OPTIONS} />
    {/* …other app-only screens */}
  </Stack.Protected>
</Stack>
```
Flip `onboardingDone`/`authed` via the `src/session/bootstrap.ts` helpers — never navigate imperatively to switch between these three roots.

## Params
- Params must be **JSON-serializable** (they round-trip through a URL) — pass **IDs only**, never full data objects. Fetch data from React Query cache using the ID inside the screen.
- Read params with `useLocalSearchParams<{ id: string }>()` from `expo-router`.
- Navigate with params: `router.push({ pathname: '/block-detail', params: { id } })`.

## Navigation actions
- `router.navigate(path)` — standard transition; no-op if already there.
- `router.push(path)` — forces a new instance; use when multiple instances are needed.
- `router.back()` — standard back. Guard with `router.canGoBack()` when needed.
- `router.replace(path)` — replace without adding to history.

## Screen lifecycle
- `useFocusEffect(useCallback(() => { ... return cleanup }, []))` from `expo-router` (re-exported from `@react-navigation/native`) for side effects that must run on focus. Always return a cleanup function.
- `useIsFocused()` when a component must re-render on focus state change.
- These still work because Expo Router screens are React Navigation screens under the hood.

## Half-sheet / modal screens
- Register in `app/_layout.tsx` with `options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false }}` (the `HALF_SHEET_OPTIONS` constant) for half-sheets, or `presentation: 'fullScreenModal'` for full-screen flows.
- Use `HalfSheet` from `src/shared/components/ui/HalfSheet.tsx` (or the feature-local variant in `src/features/blocking/components/HalfSheet.tsx`) as the content wrapper; wire `onClose={() => router.back()}`.

## The tab bar (`NativeTabs`)
- `NativeTabs.Trigger name="home"` — `name` must match the sibling route file inside `app/(tabs)/`.
- `<Icon sf={{ default: '...', selected: '...' }} drawable="ic_tab_x" />` — SF Symbols on iOS (free, no asset), a vector drawable under `android/app/src/main/res/drawable/` on Android (SDK 54: `drawable` takes a single string, no distinct selected state yet).
- `<Label>{t('navigation.tabs.x')}</Label>` — always through `t()`, keys live under `navigation.tabs.*` in `src/i18n/locales/*.json`.
- Content padding: `NativeTabs` handles safe-area insets automatically (iOS: first `ScrollView`'s content inset; Android: bottom-inset `SafeAreaView` wrapper) — do not hand-roll a tab-bar clearance constant.

## Must
- Route paths as string literals matching the `app/` file tree — no central enum to keep in sync.
- New screens: add the screen component under `src/features/<feature>/screens/`, then a thin `app/<path>.tsx` re-export, then register it in the right `Stack.Protected` group in `app/_layout.tsx` if it needs custom `options` or a guard.
- `router` from `expo-router` for imperative navigation outside a screen's own render.
- `useFocusEffect` + `useCallback` for focus-scoped side effects.

## Must not
- Do not render a second root `<Stack>`/navigator — one `app/_layout.tsx` only.
- Do not navigate imperatively to switch onboarding/auth/app — flip the gate store (`src/session/bootstrap.ts`) and let `Stack.Protected` redirect.
- Do not pass full data objects as params — pass IDs and fetch data inside the screen.
- Do not add navigation logic inside `src/shared/components/ui/` components.
- Do not reintroduce a custom animated/floating tab bar component — the tab bar is the native system one (`NativeTabs`).
