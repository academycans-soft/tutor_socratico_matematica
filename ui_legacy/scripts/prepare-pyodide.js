/**
 * Copies core Pyodide runtime files from node_modules/pyodide/ to static/pyodide/
 * so they are served as static assets during dev and included in the production build.
 * Runs automatically before `vite dev` and `vite build` via the pyodide:fetch npm script.
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src = resolve(root, 'node_modules', 'pyodide');
const dest = resolve(root, 'static', 'pyodide');

const FILES = [
	'pyodide.js',
	'pyodide.js.map',
	'pyodide.mjs',
	'pyodide.mjs.map',
	'pyodide.asm.js',
	'pyodide.asm.wasm',
	'pyodide.d.ts',
	'pyodide-lock.json',
	'python_stdlib.zip',
	'ffi.d.ts',
	'console.html',
	'package.json'
];

if (!existsSync(dest)) {
	mkdirSync(dest, { recursive: true });
}

let copied = 0;
for (const file of FILES) {
	const srcFile = resolve(src, file);
	const destFile = resolve(dest, file);
	if (existsSync(srcFile)) {
		copyFileSync(srcFile, destFile);
		copied++;
	}
}

console.log(`pyodide:fetch — synced ${copied}/${FILES.length} files to static/pyodide/`);
