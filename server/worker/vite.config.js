import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
	root: './',
	build: {
		outDir: 'dist',
		rollupOptions: {
			input: 'worker.html',
			inlineDynamicImports: true
		}
	},
	plugins: [viteSingleFile()],
	server: {
		open: true
	}
});
