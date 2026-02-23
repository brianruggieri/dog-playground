import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const PUBLIC_ASSET_DIRECTORIES = ["backgrounds", "dogs", "toys"];
export const SUPPORTED_ASSET_EXTENSIONS = new Set([".webp", ".png"]);

function parsePngDimensions(buffer) {
	const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSignature)) {
		throw new Error("Invalid PNG data.");
	}
	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
	};
}

function parseWebpDimensions(buffer) {
	if (
		buffer.length < 16 ||
		buffer.toString("ascii", 0, 4) !== "RIFF" ||
		buffer.toString("ascii", 8, 12) !== "WEBP"
	) {
		throw new Error("Invalid WebP container.");
	}

	let offset = 12;
	while (offset + 8 <= buffer.length) {
		const chunkType = buffer.toString("ascii", offset, offset + 4);
		const chunkSize = buffer.readUInt32LE(offset + 4);
		const chunkStart = offset + 8;

		if (chunkType === "VP8X" && chunkSize >= 10 && chunkStart + 10 <= buffer.length) {
			const widthMinusOne = buffer.readUIntLE(chunkStart + 4, 3);
			const heightMinusOne = buffer.readUIntLE(chunkStart + 7, 3);
			return {
				width: widthMinusOne + 1,
				height: heightMinusOne + 1,
			};
		}

		if (chunkType === "VP8 " && chunkSize >= 10 && chunkStart + 10 <= buffer.length) {
			const widthRaw = buffer.readUInt16LE(chunkStart + 6);
			const heightRaw = buffer.readUInt16LE(chunkStart + 8);
			return {
				width: widthRaw & 0x3fff,
				height: heightRaw & 0x3fff,
			};
		}

		if (chunkType === "VP8L" && chunkSize >= 5 && chunkStart + 5 <= buffer.length) {
			const b0 = buffer[chunkStart + 1];
			const b1 = buffer[chunkStart + 2];
			const b2 = buffer[chunkStart + 3];
			const b3 = buffer[chunkStart + 4];
			return {
				width: 1 + (((b1 & 0x3f) << 8) | b0),
				height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
			};
		}

		offset += 8 + chunkSize + (chunkSize % 2);
	}

	throw new Error("Unsupported WebP bitstream.");
}

function parseDimensions(buffer, extension) {
	if (extension === ".png") {
		return parsePngDimensions(buffer);
	}
	if (extension === ".webp") {
		return parseWebpDimensions(buffer);
	}
	throw new Error(`Unsupported asset extension: ${extension}`);
}

function sha256Hex(buffer) {
	return createHash("sha256").update(buffer).digest("hex");
}

export async function collectAssetRelativePaths(rootDir) {
	const relativePaths = [];

	for (const directory of PUBLIC_ASSET_DIRECTORIES) {
		const absoluteDirectory = path.join(rootDir, "public", directory);
		const entries = await readdir(absoluteDirectory, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isFile()) {
				continue;
			}
			const extension = path.extname(entry.name).toLowerCase();
			if (!SUPPORTED_ASSET_EXTENSIONS.has(extension)) {
				continue;
			}
			relativePaths.push(path.posix.join("public", directory, entry.name));
		}
	}

	relativePaths.sort((a, b) => a.localeCompare(b));
	return relativePaths;
}

export async function readAssetMetadata(rootDir, relativePath) {
	const absolutePath = path.join(rootDir, relativePath);
	const extension = path.extname(relativePath).toLowerCase();
	const role = relativePath.split("/")[1];
	const buffer = await readFile(absolutePath);
	const { width, height } = parseDimensions(buffer, extension);
	return {
		path: relativePath,
		role,
		format: extension.slice(1),
		width,
		height,
		sha256: sha256Hex(buffer),
	};
}
