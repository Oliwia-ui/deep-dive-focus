# Design customization

Deep Dive keeps timer truth separate from presentation. The state machine and time accounting live in `src/renderer/src/domain/`; visual changes should not require edits there.

## Safest customization points

- **Theme, typography, spacing, depth-zone colors, motion, and bubbles:** edit `src/renderer/src/assets/design-tokens.css`. This is the central visual token file. `main.css` contains reusable component and layout classes that consume those semantic variables.
- **Layout and component styling:** edit the named reusable classes in `src/renderer/src/assets/main.css` such as `.dive-stage`, `.setup-card`, `.surface-card`, `.metric`, `.history-card`, and `.settings-card`. Prefer adding or changing a token before adding a one-off literal.
- **Depth mapping and zone labels:** edit `src/renderer/src/visual-config.ts`. `depthForMinutes()` changes only the illustration; it never changes planned or actual session time. `DEPTH_ZONES` controls the five labels displayed on the stage.
- **Interface copy and component composition:** edit `src/renderer/src/App.tsx`. Shared visual pieces such as `Metric`, `WaveIcon`, and `DiverIcon` are reusable components; session behavior is delegated to domain functions.
- **Motion:** change the `--motion-*` and `--bubble-*` tokens plus the keyframes in `main.css`. Keep the existing `prefers-reduced-motion` block so macOS Reduce Motion continues to disable decorative animation.

## Safety boundary

Do not derive elapsed time from CSS transitions, animation frames, or React render frequency. `domain/timer.ts` calculates time from stored timestamps, and `domain/session-store.ts` owns mutation/log sequencing. Styling and depth changes should remain one-way consumers of those values.
