import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Next.js 16 ships "next lint" as a separate CLI; the config itself is provided
// by `eslint-config-next` and is compatible with ESLint flat config.
export default require('eslint-config-next/core-web-vitals');

