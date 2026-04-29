const MANIFEST_PATHS = new Set([
    '/stable/version.json',
    '/beta/version.json',
    '/beta/access.json'
]);

const DOWNLOAD_PREFIX = '/downloads/';

function withCors(headers) {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Disposition, ETag');
    return headers;
}

function isSafeDownloadName(fileName) {
    return /^[A-Za-z0-9._-]+\.apk$/.test(fileName);
}

function addManifestHeaders(response) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('Content-Type', 'application/json; charset=utf-8');
    withCors(headers);

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

async function serveDownload(request, env, url) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: withCors(new Headers())
        });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
            status: 405,
            headers: withCors(new Headers({ Allow: 'GET, HEAD, OPTIONS' }))
        });
    }

    let fileName = '';
    try {
        fileName = decodeURIComponent(url.pathname.slice(DOWNLOAD_PREFIX.length));
    } catch (error) {
        return new Response('Not found', { status: 404 });
    }

    if (!isSafeDownloadName(fileName)) {
        return new Response('Not found', { status: 404 });
    }

    const object = await env.APP_RELEASES.get(`${DOWNLOAD_PREFIX.slice(1)}${fileName}`);
    if (!object) {
        return new Response('Not found', {
            status: 404,
            headers: withCors(new Headers())
        });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', headers.get('Content-Type') || 'application/vnd.android.package-archive');
    headers.set('Content-Length', String(object.size));
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    withCors(headers);

    return new Response(request.method === 'HEAD' ? null : object.body, {
        status: 200,
        headers
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith(DOWNLOAD_PREFIX)) {
            return serveDownload(request, env, url);
        }

        const response = await env.ASSETS.fetch(request);
        if (MANIFEST_PATHS.has(url.pathname)) {
            return addManifestHeaders(response);
        }

        return response;
    }
};
