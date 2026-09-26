// Citation.js imports node-fetch for its Node runtime even when it ultimately
// selects the browser Fetch API. Vite resolves that static import eagerly, so
// provide the browser-native surface and keep Node streams out of the renderer.
const browserFetch: typeof fetch = (...args) => globalThis.fetch(...args);

export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
export default browserFetch;
