# Mobile E2E tests

The flows use Maestro and run against a development build on a simulator or
physical device. They intentionally rely on visible labels instead of internal
React test IDs so they exercise the accessibility surface used by real users.

## Prerequisites

1. Install Maestro: `curl -Ls https://get.maestro.mobile.dev | bash`.
2. Create and install a development build with the deterministic E2E control:
   `EXPO_PUBLIC_E2E=true npx expo run:ios` or
   `EXPO_PUBLIC_E2E=true npx expo run:android`.
3. Configure `mobile/.env` with a test Supabase project containing the
   published seed beaches.
4. Start an iOS Simulator or Android emulator, or connect a physical device.

## Run

```bash
cd mobile
npm run test:e2e
```

Run one flow while debugging:

```bash
maestro test e2e/map-inspection.yaml
maestro test e2e/proximity.yaml
```

The hazard flow validates the hazard inspection and warning copy. Deterministic
geofence notification delivery is covered by Jest through
`simulateGeofenceEntry`; background callbacks require a development build and
cannot be made reliable in Expo Go.

The quality-gate workflow validates every flow on all pull requests. To execute
the Maestro smoke flows in CI, provide a runner/device identifier through the
`MAESTRO_DEVICE_ID` repository secret; GitHub-hosted runners do not provide a
mobile device by default.
