import { readFile } from "node:fs/promises";
import path from "node:path";
import { collectAssetRelativePaths, readAssetMetadata } from "./asset-manifest-lib.mjs";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "ASSET_MANIFEST.json");

function failWith(errors) {
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

function getKeySet(values) {
	return new Set(values);
}

const errors = [];
let manifest = null;
try {
	const rawManifest = await readFile(manifestPath, "utf8");
	manifest = JSON.parse(rawManifest);
} catch (error) {
	failWith([`Unable to read/parse ASSET_MANIFEST.json: ${error.message}`]);
}

if (!manifest || typeof manifest !== "object") {
	failWith(["ASSET_MANIFEST.json must contain a top-level JSON object."]);
}

if (manifest.asset_license !== "CC-BY-4.0") {
	errors.push(`asset_license must be "CC-BY-4.0", found "${manifest.asset_license || ""}".`);
}

if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
	errors.push("assets must be a non-empty array.");
	failWith(errors);
}

const filesystemPaths = await collectAssetRelativePaths(rootDir);
const filesystemPathSet = getKeySet(filesystemPaths);
const manifestPaths = manifest.assets.map((asset) => asset.path);
const manifestPathSet = getKeySet(manifestPaths);

for (const pathOnDisk of filesystemPaths) {
	if (!manifestPathSet.has(pathOnDisk)) {
		errors.push(`Missing manifest entry for ${pathOnDisk}`);
	}
}

for (const manifestPathEntry of manifestPaths) {
	if (!filesystemPathSet.has(manifestPathEntry)) {
		errors.push(`Manifest entry points to missing asset ${manifestPathEntry}`);
	}
}

const seenPaths = new Set();
for (const asset of manifest.assets) {
	if (!asset || typeof asset !== "object") {
		errors.push("Each manifest asset entry must be an object.");
		continue;
	}

	if (!asset.path || typeof asset.path !== "string") {
		errors.push("Each asset entry requires a string path.");
		continue;
	}

	if (seenPaths.has(asset.path)) {
		errors.push(`Duplicate manifest path ${asset.path}`);
	}
	seenPaths.add(asset.path);

	if (!/^[a-f0-9]{64}$/.test(asset.sha256 || "")) {
		errors.push(`Invalid SHA-256 for ${asset.path}`);
	}

	if (!Number.isInteger(asset.width) || asset.width <= 0) {
		errors.push(`Invalid width for ${asset.path}`);
	}

	if (!Number.isInteger(asset.height) || asset.height <= 0) {
		errors.push(`Invalid height for ${asset.path}`);
	}

	if (!["backgrounds", "dogs", "toys"].includes(asset.role)) {
		errors.push(`Invalid role for ${asset.path}: ${asset.role}`);
	}

	if (!["webp", "png"].includes(asset.format)) {
		errors.push(`Invalid format for ${asset.path}: ${asset.format}`);
	}

	if (asset.source_type !== "ai-generated") {
		errors.push(`source_type must be "ai-generated" for ${asset.path}`);
	}

	if (asset.source_tool !== "chatgpt-image-generation") {
		errors.push(`source_tool must be "chatgpt-image-generation" for ${asset.path}`);
	}

	if (asset.creator !== "Brian Ruggieri") {
		errors.push(`creator must be "Brian Ruggieri" for ${asset.path}`);
	}
}

for (const asset of manifest.assets) {
	if (!asset.path || !filesystemPathSet.has(asset.path)) {
		continue;
	}

	const isWebp = asset.path.endsWith(".webp");
	const isPng = asset.path.endsWith(".png");
	const expectedBackupPath = isWebp ? asset.path.replace(/\.webp$/, ".png") : "";
	const expectedBackupOf = isPng ? asset.path.replace(/\.png$/, ".webp") : "";

	if (isWebp) {
		if (!filesystemPathSet.has(expectedBackupPath)) {
			errors.push(`Missing PNG backup file for ${asset.path}`);
		}
		if (asset.backup_path !== expectedBackupPath) {
			errors.push(`backup_path mismatch for ${asset.path}`);
		}
	}

	if (isPng) {
		if (!filesystemPathSet.has(expectedBackupOf)) {
			errors.push(`Missing WebP primary file for ${asset.path}`);
		}
		if (asset.backup_of !== expectedBackupOf) {
			errors.push(`backup_of mismatch for ${asset.path}`);
		}
	}
}

for (const assetPath of filesystemPaths) {
	const manifestEntry = manifest.assets.find((entry) => entry.path === assetPath);
	if (!manifestEntry) {
		continue;
	}

	const actualMetadata = await readAssetMetadata(rootDir, assetPath);
	if (manifestEntry.sha256 !== actualMetadata.sha256) {
		errors.push(`SHA mismatch for ${assetPath}`);
	}
	if (manifestEntry.width !== actualMetadata.width || manifestEntry.height !== actualMetadata.height) {
		errors.push(`Dimension mismatch for ${assetPath}`);
	}
	if (manifestEntry.format !== actualMetadata.format) {
		errors.push(`Format mismatch for ${assetPath}`);
	}
	if (manifestEntry.role !== actualMetadata.role) {
		errors.push(`Role mismatch for ${assetPath}`);
	}
}

if (errors.length) {
	failWith(errors);
}

console.log(`Asset compliance check passed for ${filesystemPaths.length} assets.`);
