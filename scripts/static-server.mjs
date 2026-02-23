import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const rootArg = process.argv[2] || ".";
const servedRoot = path.resolve(projectRoot, rootArg);
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

function safePathFromUrl(urlPath) {
	const decoded = decodeURIComponent(urlPath.split("?")[0]);
	const relativePath = decoded === "/" ? "/index.html" : decoded;
	const fullPath = path.resolve(servedRoot, `.${relativePath}`);
	const relativeToRoot = path.relative(servedRoot, fullPath);
	if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
		return null;
	}
	return fullPath;
}

async function readRequestedFile(filePath) {
	try {
		return await readFile(filePath);
	} catch {
		if (!path.extname(filePath)) {
			try {
				return await readFile(path.join(servedRoot, "index.html"));
			} catch {
				return null;
			}
		}
		return null;
	}
}

const server = createServer(async (request, response) => {
	const safePath = safePathFromUrl(request.url || "/");
	if (!safePath) {
		response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Forbidden");
		return;
	}

	const body = await readRequestedFile(safePath);
	if (!body) {
		response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Not found");
		return;
	}

	const extension = path.extname(safePath).toLowerCase();
	const contentType = mimeTypes[extension] || "application/octet-stream";
	response.writeHead(200, { "Content-Type": contentType });
	response.end(body);
});

server.listen(port, () => {
	console.log(`Serving ${servedRoot} at http://localhost:${port}`);
});
