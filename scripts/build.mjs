import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await Promise.all([
	cp(path.join(rootDir, "index.html"), path.join(distDir, "index.html")),
	cp(path.join(rootDir, "src"), path.join(distDir, "src"), { recursive: true }),
	cp(path.join(rootDir, "public"), path.join(distDir, "public"), { recursive: true }),
]);

console.log("Built static output in dist/");
