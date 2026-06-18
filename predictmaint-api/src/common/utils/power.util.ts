/** Potencia mecánica: P(W) = torque(N·m) × rpm × 2π / 60 */
export function calculatePowerW(torque: number, rotationalSpeed: number): number {
  return Math.round(((torque * rotationalSpeed * 2 * Math.PI) / 60) * 100) / 100;
}
