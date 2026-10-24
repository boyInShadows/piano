import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'out/**',
    '.agents/**',
    '.claude/**',
    'graphify-out/**',
    'artifacts/**',
    'playwright-report/**',
    'test-results/**',
    'design-concepts/**',
  ]),
]);
