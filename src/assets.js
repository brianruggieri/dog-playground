const moduleBaseUrl = new URL("../", import.meta.url);

export function resolveAssetUrl(pathOrUrl) {
	if (!pathOrUrl) {
		return "";
	}
	if (/^[a-zA-Z]+:/.test(pathOrUrl)) {
		return pathOrUrl;
	}
	const normalizedPath = String(pathOrUrl).replace(/^\/+/, "");
	return new URL(normalizedPath, moduleBaseUrl).toString();
}
