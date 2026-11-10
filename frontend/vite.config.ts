import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// React on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
// Tailwind v4: https://tailwindcss.com/docs/installation/using-vite
export default defineConfig({
	plugins: [react(), tailwindcss(), cloudflare()],
	// Backend dev server owns 5173; its CORS allows exactly http://localhost:5174.
	server: { port: 5174, strictPort: true },
});
