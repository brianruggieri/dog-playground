import { writeFile } from "node:fs/promises";
import path from "node:path";
import { collectAssetRelativePaths, readAssetMetadata } from "./asset-manifest-lib.mjs";

const rootDir = process.cwd();
const outputPath = path.join(rootDir, "ASSET_MANIFEST.json");

const relativePaths = await collectAssetRelativePaths(rootDir);
const relativePathSet = new Set(relativePaths);

const assets = [];
for (const relativePath of relativePaths) {
	const metadata = await readAssetMetadata(rootDir, relativePath);
	const isWebp = relativePath.endsWith(".webp");
	const isPng = relativePath.endsWith(".png");
	const webpPath = relativePath.replace(/\.png$/, ".webp");
	const pngPath = relativePath.replace(/\.webp$/, ".png");

	assets.push({
		...metadata,
		source_type: "ai-generated",
		source_tool: "chatgpt-image-generation",
		creator: "Brian Ruggieri",
		backup_path: isWebp && relativePathSet.has(pngPath) ? pngPath : "",
		backup_of: isPng && relativePathSet.has(webpPath) ? webpPath : "",
	});
}

const manifest = {
	manifest_version: 1,
	code_license: "MIT",
	asset_license: "CC-BY-4.0",
	source_defaults: {
		source_type: "ai-generated",
		source_tool: "chatgpt-image-generation",
		creator: "Brian Ruggieri",
	},
	assets,
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
console.log(`Wrote ${assets.length} asset entries to ASSET_MANIFEST.json`);
