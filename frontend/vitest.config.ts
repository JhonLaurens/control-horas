import { defineConfig } from 'vitest/config';

// Las pruebas del motor usan la hora local de Colombia (igual que el backend).
process.env.TZ = 'America/Bogota';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
