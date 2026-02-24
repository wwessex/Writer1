import { loadConfigFromFile } from 'vite';

const result = await loadConfigFromFile(
  { command: 'serve', mode: 'test' },
  'vite.config.ts'
);

if (!result?.config) {
  console.error('Failed to load vite.config.ts');
  process.exit(1);
}

console.log('vite.config.ts loaded successfully.');
