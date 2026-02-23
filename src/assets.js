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

export function derivePngBackupPath(pathOrUrl) {
	if (!pathOrUrl || !/\.webp(?:\?|$)/i.test(pathOrUrl)) {
		return "";
	}
	return String(pathOrUrl).replace(/\.webp(\?.*)?$/i, ".png$1");
}

function getMimeTypeForPath(pathOrUrl) {
	if (/\.webp(?:\?|$)/i.test(pathOrUrl)) {
		return "image/webp";
	}
	if (/\.png(?:\?|$)/i.test(pathOrUrl)) {
		return "image/png";
	}
	if (/\.jpe?g(?:\?|$)/i.test(pathOrUrl)) {
		return "image/jpeg";
	}
	if (/\.svg(?:\?|$)/i.test(pathOrUrl)) {
		return "image/svg+xml";
	}
	return "";
}

export function resolveAssetWithBackup(pathOrUrl, backupPathOrUrl = "") {
	const primaryUrl = resolveAssetUrl(pathOrUrl);
	const fallbackInput = backupPathOrUrl || derivePngBackupPath(pathOrUrl);
	const backupUrl = fallbackInput ? resolveAssetUrl(fallbackInput) : "";
	return { primaryUrl, backupUrl };
}

export function buildCssImageWithFallback(pathOrUrl, backupPathOrUrl = "") {
	const { primaryUrl, backupUrl } = resolveAssetWithBackup(pathOrUrl, backupPathOrUrl);
	if (!backupUrl || backupUrl === primaryUrl) {
		return `url("${primaryUrl}")`;
	}

	const primaryMime = getMimeTypeForPath(primaryUrl);
	const backupMime = getMimeTypeForPath(backupUrl);
	const primaryDescriptor = primaryMime
		? `url("${primaryUrl}") type("${primaryMime}")`
		: `url("${primaryUrl}")`;
	const backupDescriptor = backupMime
		? `url("${backupUrl}") type("${backupMime}")`
		: `url("${backupUrl}")`;

	return `image-set(${primaryDescriptor}, ${backupDescriptor})`;
}

export function setElementBackgroundImageWithFallback(
	element,
	pathOrUrl,
	backupPathOrUrl = "",
) {
	const { primaryUrl, backupUrl } = resolveAssetWithBackup(pathOrUrl, backupPathOrUrl);
	if (!backupUrl || backupUrl === primaryUrl) {
		element.style.backgroundImage = `url("${primaryUrl}")`;
		return;
	}

	// Set PNG first so older engines keep a usable background if image-set is unsupported.
	element.style.backgroundImage = `url("${backupUrl}")`;
	element.style.backgroundImage = buildCssImageWithFallback(pathOrUrl, backupPathOrUrl);
}
