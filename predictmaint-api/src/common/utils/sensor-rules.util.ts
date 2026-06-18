import { calculatePowerW } from './power.util';

export interface SensorReadingInput {
  airTemperature: number;
  processTemperature: number;
  rotationalSpeed: number;
  torque: number;
  toolWear: number;
}

export interface TriggeredRule {
  reglaCodigo: string;
  tipoFallo: string;
}

export function evaluateSensorRules(input: SensorReadingInput): TriggeredRule | null {
  const tempDiff = input.processTemperature - input.airTemperature;
  const powerW = calculatePowerW(input.torque, input.rotationalSpeed);

  if (tempDiff > 8.6 || input.rotationalSpeed < 1380) {
    return { reglaCodigo: 'RN-01', tipoFallo: 'HDF' };
  }
  if (powerW < 3500 || powerW > 9000) {
    return { reglaCodigo: 'RN-02', tipoFallo: 'PWF' };
  }
  if (input.toolWear >= 200) {
    return { reglaCodigo: 'RN-03', tipoFallo: 'TWF' };
  }
  if (input.torque * input.toolWear > 5000) {
    return { reglaCodigo: 'RN-04', tipoFallo: 'OSF' };
  }
  return null;
}
