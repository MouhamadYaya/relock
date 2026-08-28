// Absorbs `relock://dev/*` deep links so Expo Router's own linking listener
// doesn't flash an "Unmatched Route" screen — `src/session/dev-test-bridge.ts`
// listens to the same URLs separately and does the actual (dev-only) routing.
export default function DevBridgeCatchAll() {
  return null
}
