let files = new Map();

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SET_FILES') {
		files = new Map(event.data.files);
		console.log('Set files:', event.data.files);
	} else if (event.data?.type === 'UPDATE_FILES') {
		for (const [path, file] of event.data.files) {
			files.set(path, file);
		}
		// console.log('Updated files:', event.data.files);
	} else if (event.data?.type === 'REMOVE_FILES') {
    for (const path of event.data.files) {
			files.delete(path);
		}
		// console.log('Removed files:', event.data.files);
  }
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
  
	if (!url.pathname.startsWith('/preview/') && !url.pathname.startsWith('/huitml/preview/')) {
		console.log('Could not handle:', url.pathname);
		return;
	}

	const path = url.pathname.replace("/huitml", '').replace('/preview', '') || '/index.html';
  

	if (!files.has(path)) {
    return;
    console.log("Not found", files);
		event.respondWith(new Response('Not found', { status: 404 }));
		return;
	}

  console.log(path);
	const file = files.get(path);
  
  console.log("Found file:", file);
	event.respondWith(
		new Response(file, {
			headers: { 'Content-Type': file.type || guessType(path) }
		})
	);
});

function guessType(path) {
	if (path.endsWith('.html')) return 'text/html';
	if (path.endsWith('.css')) return 'text/css';
	if (path.endsWith('.js')) return 'text/javascript';
	if (path.endsWith('.png')) return 'image/png';
	if (path.endsWith('.jpg')) return 'image/jpg';
	return 'application/octet-stream';
}
