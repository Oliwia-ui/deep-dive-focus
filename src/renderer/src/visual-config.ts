export const DEPTH_ZONES = ['Shallows', 'Reef', 'Blue Water', 'Twilight', 'The Deep'] as const

/**
 * Illustrative focus-depth mapping only. It has no effect on timer accounting.
 * Adjust the multiplier and bounds to change the visual depth curve.
 */
export function depthForMinutes(minutes: number): number {
  return Math.min(40, Math.max(6, Math.round(minutes * 0.75)))
}
