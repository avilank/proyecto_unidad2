/** Valores de un enum TS para DataType.ENUM de Sequelize (sync al arranque). */
export const enumValues = <T extends Record<string, string>>(
  e: T,
): [string, ...string[]] => Object.values(e) as [string, ...string[]];
