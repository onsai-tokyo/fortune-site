import { cpSync } from 'node:fs';
cpSync(new URL('../src/lib/report/annual3600/data/',import.meta.url),new URL('../dist/lib/report/annual3600/data/',import.meta.url),{recursive:true});

cpSync(new URL('../src/lib/report/compatibilityV24/data/',import.meta.url),new URL('../dist/lib/report/compatibilityV24/data/',import.meta.url),{recursive:true});
