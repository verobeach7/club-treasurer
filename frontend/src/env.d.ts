/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Backend Worker origin, e.g. https://club-treasurer-api.<account>.workers.dev (no trailing slash). */
	readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
