// Static SPA assets are served before this Worker runs (assets.not_found_handling =
// single-page-application). The API lives in the separate backend Worker.
export default {
	fetch() {
		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
