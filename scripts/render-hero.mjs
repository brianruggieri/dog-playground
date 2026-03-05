import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function getArgValue(flag) {
	const index = process.argv.indexOf(flag);
	if (index === -1) {
		return null;
	}
	return process.argv[index + 1] || null;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function toUrlPath(assetPath) {
	if (!assetPath) {
		return "";
	}
	if (/^https?:\/\//i.test(assetPath)) {
		return assetPath;
	}
	if (assetPath.startsWith("/")) {
		return assetPath;
	}
	const normalized = assetPath.replace(/\\/g, "/");
	return `/${normalized}`;
}

const configPath =
	getArgValue("--config") || path.join(projectRoot, "public/readme/hero.config.json");
const htmlOutPath =
	getArgValue("--html") || path.join(projectRoot, "public/readme/hero.html");
const imageOutPath =
	getArgValue("--out") || path.join(projectRoot, "public/readme/hero.png");
const skipScreenshot = process.argv.includes("--skip-screenshot");

const config = JSON.parse(await readFile(configPath, "utf8"));
const width = Number(config.width || 1800);
const height = Number(config.height || 600);

const backgroundUrl = toUrlPath(config.background || "public/backgrounds/grass-tile.png");
const dogUrl = toUrlPath(config.dog || "public/dogs/dog-01.png");
const toyUrl = toUrlPath(config.toy || "public/toys/frisbee.png");

const templatePath = path.join(projectRoot, "public/readme/hero.template.html");
const template = await readFile(templatePath, "utf8");

const html = template
	.replaceAll("{{title}}", escapeHtml(config.title || "Dog Playground"))
	.replaceAll(
		"{{subtitle}}",
		escapeHtml(config.subtitle || "Throw toys, watch pups chase, and explore big backyard vibes."),
	)
	.replaceAll("{{badge}}", escapeHtml(config.badge || "Drag-to-Throw Physics"))
	.replaceAll("{{backgroundUrl}}", backgroundUrl)
	.replaceAll("{{dogUrl}}", dogUrl)
	.replaceAll("{{toyUrl}}", toyUrl)
	.replaceAll("{{width}}", String(width))
	.replaceAll("{{height}}", String(height));

await writeFile(htmlOutPath, html);

if (skipScreenshot) {
	process.exit(0);
}

const port = Number(config.port || 5179);
const serverScript = path.join(projectRoot, "scripts/static-server.mjs");
const serverProcess = spawn("node", [serverScript, "."], {
	cwd: projectRoot,
	stdio: ["ignore", "pipe", "pipe"],
	env: { ...process.env, PORT: String(port) },
});

const waitForServer = () =>
	new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error("Timed out waiting for static server."));
		}, 4000);

		const onData = (chunk) => {
			const text = chunk.toString();
			if (text.includes("Serving")) {
				clearTimeout(timeout);
				serverProcess.stdout?.off("data", onData);
				resolve();
			}
		};

		serverProcess.stdout?.on("data", onData);
		serverProcess.stderr?.on("data", onData);
	});

await waitForServer();

const cwdCandidate = path.join(projectRoot, ".codex");
const cwd = existsSync(cwdCandidate) ? cwdCandidate : projectRoot;
const session = "hero-render";
const baseArgs = ["--yes", "--package", "@playwright/cli", "playwright-cli", "--session", session];
const env = { ...process.env };
const heroUrl = `http://localhost:${port}/public/readme/hero.html`;

const openResult = spawnSync("npx", [...baseArgs, "open", heroUrl], { cwd, stdio: "inherit", env });
if (openResult.status !== 0) {
	serverProcess.kill();
	process.exit(openResult.status || 1);
}

const resizeResult = spawnSync(
	"npx",
	[...baseArgs, "resize", String(width), String(height)],
	{ cwd, stdio: "inherit", env },
);
if (resizeResult.status !== 0) {
	serverProcess.kill();
	process.exit(resizeResult.status || 1);
}

const waitResult = spawnSync(
	"npx",
	[...baseArgs, "run-code", "async (page) => { await page.waitForTimeout(800); }"],
	{ cwd, stdio: "inherit", env },
);
if (waitResult.status !== 0) {
	serverProcess.kill();
	process.exit(waitResult.status || 1);
}

const shotResult = spawnSync(
	"npx",
	[...baseArgs, "screenshot", "--filename", imageOutPath],
	{ cwd, stdio: "inherit", env },
);

spawnSync("npx", [...baseArgs, "close"], { cwd, stdio: "inherit", env });
serverProcess.kill();

if (shotResult.status !== 0) {
	process.exit(shotResult.status || 1);
}
