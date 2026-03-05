import { DOG_SPRITE_TARGET_HEIGHT, GRID_PIXEL_SIZE } from "./constants.js";
import { getDog, getDogOptions } from "./catalog/dogs.js";
import { getToy, getToyOptions } from "./catalog/toys.js";
import {
	buildCssImageWithFallback,
	resolveAssetUrl,
	resolveAssetWithBackup,
	setElementBackgroundImageWithFallback,
} from "./assets.js";
import {
	calculateToyDiameterPx,
	clamp,
	computeToyLaunch,
	stepToyPhysics,
	toCanvasPoint,
} from "./engine/physics.js";
import { createInitialDogState, stepDogState } from "./engine/dogBehavior.js";

const fallbackBackgrounds = [
	{ id: "none", name: "None", url: "" },
	{
		id: "dirt",
		name: "Dirt",
		url: resolveAssetUrl("public/backgrounds/dirt-tile.webp"),
		backupUrl: resolveAssetUrl("public/backgrounds/dirt-tile.png"),
	},
	{
		id: "grass",
		name: "Grass",
		url: resolveAssetUrl("public/backgrounds/grass-tile.webp"),
		backupUrl: resolveAssetUrl("public/backgrounds/grass-tile.png"),
	},
	{
		id: "gravel",
		name: "Gravel",
		url: resolveAssetUrl("public/backgrounds/gravel-tile.webp"),
		backupUrl: resolveAssetUrl("public/backgrounds/gravel-tile.png"),
	},
	{
		id: "sand",
		name: "Sand",
		url: resolveAssetUrl("public/backgrounds/sand-tile.webp"),
		backupUrl: resolveAssetUrl("public/backgrounds/sand-tile.png"),
	},
	{
		id: "tile",
		name: "Tile",
		url: resolveAssetUrl("public/backgrounds/tile-tile.webp"),
		backupUrl: resolveAssetUrl("public/backgrounds/tile-tile.png"),
	},
];

const el = {
	controlPanel: document.getElementById("control-panel"),
	viewport: document.getElementById("viewport"),
	world: document.getElementById("world"),
	dogSprite: document.getElementById("dog-sprite"),
	dogImage: document.getElementById("dog-image"),
	mobilePanelToggle: document.getElementById("mobile-panel-toggle"),
	mobileControlsFab: document.getElementById("mobile-controls-fab"),
	mobileThrowToggle: document.getElementById("mobile-throw-toggle"),
	backgroundPicker: document.getElementById("background-picker"),
	backgroundLabel: document.getElementById("background-label"),
	textureSelect: document.getElementById("texture-select"),
	dogPicker: document.getElementById("dog-picker"),
	dogLabel: document.getElementById("dog-label"),
	dogSelect: document.getElementById("dog-select"),
	toyPicker: document.getElementById("toy-picker"),
	toyLabel: document.getElementById("toy-label"),
	toySelect: document.getElementById("toy-select"),
	toggleThrow: document.getElementById("toggle-throw"),
	centerView: document.getElementById("center-view"),
	zoomOut: document.getElementById("zoom-out"),
	zoomIn: document.getElementById("zoom-in"),
	zoomReset: document.getElementById("zoom-reset"),
	zoomLabel: document.getElementById("zoom-label"),
	dragOverlay: document.getElementById("drag-overlay"),
	dragLine: document.getElementById("drag-line"),
	toyPreview: document.getElementById("toy-preview"),
};

for (const [key, value] of Object.entries(el)) {
	if (!value) {
		throw new Error(`Missing required DOM element: ${key}`);
	}
}

const state = {
	backgrounds: [],
	backgroundId: "grass",
	dotColor: "rgba(148, 163, 184, 0.9)",
	selectedDogId: getDogOptions()[0]?.id || "",
	selectedToyId: getToyOptions()[0]?.id || "",
	throwMode: true,
	zoom: 1,
	pan: { x: 0, y: 0 },
	isPanning: false,
	isSpacePressed: false,
	panDragStart: null,
	panPointerId: null,
	isDraggingThrow: false,
	throwPointerId: null,
	dragStartClient: null,
	dragCurrentClient: null,
	toys: [],
	toyCounter: 0,
	mobilePanelOpen: false,
	isMobileLayout: false,
	dog: createInitialDogState(GRID_PIXEL_SIZE),
};

let backgroundRequestToken = 0;
let frameLastTime = performance.now();
const activePointers = new Map();
const mobileLayoutMedia = window.matchMedia("(max-width: 920px)");

el.world.style.width = `${GRID_PIXEL_SIZE}px`;
el.world.style.height = `${GRID_PIXEL_SIZE}px`;

function setSelectOptions(select, options, selectedId) {
	select.innerHTML = "";
	for (const option of options) {
		const optionElement = document.createElement("option");
		optionElement.value = option.id;
		optionElement.textContent = option.name;
		if (option.id === selectedId) {
			optionElement.selected = true;
		}
		select.appendChild(optionElement);
	}
}

function updatePickerLabel(labelElement, options, selectedId, fallback = "") {
	if (!labelElement) {
		return;
	}
	const selected = options.find((option) => option.id === selectedId);
	labelElement.textContent = selected?.name || fallback || selectedId || "";
}

function updatePickerSelection(container, selectedId) {
	if (!container) {
		return;
	}
	for (const button of container.querySelectorAll("button[data-value]")) {
		const isSelected = button.dataset.value === selectedId;
		button.classList.toggle("is-selected", isSelected);
		button.setAttribute("aria-checked", isSelected ? "true" : "false");
	}
}

function createPickerCard(option, selectedId, config) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "picker-card";
	button.dataset.value = option.id;
	const isSelected = option.id === selectedId;
	button.classList.toggle("is-selected", isSelected);
	button.setAttribute("role", "radio");
	button.setAttribute("aria-checked", isSelected ? "true" : "false");
	button.setAttribute("aria-label", option.name);

	const thumb = document.createElement("div");
	thumb.className = `picker-thumb picker-thumb--${config.kind}`;

	if (config.kind === "background") {
		if (option.url) {
			setElementBackgroundImageWithFallback(thumb, option.url, option.backupUrl);
		} else {
			thumb.classList.add("is-none");
		}
	}

	if (config.kind === "dog") {
		const frame = option.frames?.[0] || "";
		const backupFrame = option.backupFrames?.[0] || "";
		if (frame) {
			setElementBackgroundImageWithFallback(thumb, frame, backupFrame);
		} else {
			thumb.classList.add("is-none");
		}
	}

	if (config.kind === "toy") {
		if (option.assetUrl) {
			setElementBackgroundImageWithFallback(
				thumb,
				option.assetUrl,
				option.backupAssetUrl,
			);
		} else {
			thumb.classList.add("is-none");
		}
	}

	const label = document.createElement("div");
	label.className = "picker-text";
	label.textContent = option.name;

	button.appendChild(thumb);
	button.appendChild(label);

	if (config.showDescription && option.description) {
		const meta = document.createElement("div");
		meta.className = "picker-meta";
		meta.textContent = option.description;
		button.appendChild(meta);
	}

	return button;
}

function renderPicker(container, options, selectedId, config) {
	if (!container) {
		return;
	}
	container.innerHTML = "";
	const fragment = document.createDocumentFragment();
	for (const option of options) {
		fragment.appendChild(createPickerCard(option, selectedId, config));
	}
	container.appendChild(fragment);
}

function getViewportRect() {
	return el.viewport.getBoundingClientRect();
}

function isViewportHudControlTarget(target) {
	if (!(target instanceof Element)) {
		return false;
	}
	return Boolean(
		target.closest(".viewport-hud button") ||
		target.closest(".mobile-quick-controls button"),
	);
}
function getCenteredPan(zoomValue) {
	const rect = getViewportRect();
	const scaledWidth = GRID_PIXEL_SIZE * zoomValue;
	const scaledHeight = GRID_PIXEL_SIZE * zoomValue;
	return {
		x: (rect.width - scaledWidth) / 2,
		y: (rect.height - scaledHeight) / 2,
	};
}

function clampZoom(zoomValue) {
	return clamp(zoomValue, 0.1, 5);
}

function clampPan(panValue, zoomValue) {
	const rect = getViewportRect();
	const scaledWidth = GRID_PIXEL_SIZE * zoomValue;
	const scaledHeight = GRID_PIXEL_SIZE * zoomValue;
	const next = { ...panValue };

	if (scaledWidth <= rect.width) {
		next.x = (rect.width - scaledWidth) / 2;
	} else {
		const minX = rect.width - scaledWidth;
		next.x = clamp(next.x, minX, 0);
	}

	if (scaledHeight <= rect.height) {
		next.y = (rect.height - scaledHeight) / 2;
	} else {
		const minY = rect.height - scaledHeight;
		next.y = clamp(next.y, minY, 0);
	}

	return next;
}

function renderTransform() {
	el.world.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
	el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function centerCanvas(zoomValue = state.zoom) {
	state.zoom = clampZoom(zoomValue);
	state.pan = getCenteredPan(state.zoom);
	renderTransform();
}

function zoomAroundVisibleGridCenter(nextZoom, previousZoom) {
	const rect = getViewportRect();
	const previousPan = state.pan;
	const viewLeft = -previousPan.x / previousZoom;
	const viewTop = -previousPan.y / previousZoom;
	const viewRight = (rect.width - previousPan.x) / previousZoom;
	const viewBottom = (rect.height - previousPan.y) / previousZoom;

	const visibleLeft = Math.max(0, viewLeft);
	const visibleTop = Math.max(0, viewTop);
	const visibleRight = Math.min(GRID_PIXEL_SIZE, viewRight);
	const visibleBottom = Math.min(GRID_PIXEL_SIZE, viewBottom);

	const worldCenterX = (visibleLeft + visibleRight) / 2;
	const worldCenterY = (visibleTop + visibleBottom) / 2;

	const screenCenterX = worldCenterX * previousZoom + previousPan.x;
	const screenCenterY = worldCenterY * previousZoom + previousPan.y;

	state.zoom = nextZoom;
	state.pan = clampPan(
		{
			x: screenCenterX - worldCenterX * nextZoom,
			y: screenCenterY - worldCenterY * nextZoom,
		},
		nextZoom,
	);
	renderTransform();
}

function zoomByDelta(delta) {
	const previousZoom = state.zoom;
	const nextZoom = clampZoom(previousZoom + delta);
	zoomAroundVisibleGridCenter(nextZoom, previousZoom);
}

function updateThrowButtons() {
	el.toggleThrow.textContent = `Throw Mode: ${state.throwMode ? "On" : "Off"}`;
	el.mobileThrowToggle.textContent = `Throw: ${state.throwMode ? "On" : "Off"}`;
	el.toggleThrow.classList.toggle("is-on", state.throwMode);
	el.mobileThrowToggle.classList.toggle("is-on", state.throwMode);
}

function setMobilePanelOpen(nextOpen) {
	if (!state.isMobileLayout) {
		state.mobilePanelOpen = false;
		document.body.classList.remove("mobile-ui-open");
		el.mobilePanelToggle.setAttribute("aria-expanded", "false");
		el.mobileControlsFab.setAttribute("aria-expanded", "false");
		el.mobilePanelToggle.textContent = "Open Controls";
		el.mobileControlsFab.textContent = "Show UI";
		return;
	}

	state.mobilePanelOpen = nextOpen;
	document.body.classList.toggle("mobile-ui-open", nextOpen);
	const expanded = nextOpen ? "true" : "false";
	el.mobilePanelToggle.setAttribute("aria-expanded", expanded);
	el.mobileControlsFab.setAttribute("aria-expanded", expanded);
	el.mobilePanelToggle.textContent = nextOpen ? "Close Controls" : "Open Controls";
	el.mobileControlsFab.textContent = nextOpen ? "Hide UI" : "Show UI";
}

function syncMobileLayout(isMobileLayout) {
	state.isMobileLayout = isMobileLayout;
	document.body.classList.toggle("mobile-layout", isMobileLayout);
	setMobilePanelOpen(false);
}

function setThrowMode(nextMode) {
	state.throwMode = nextMode;
	updateThrowButtons();
	el.viewport.classList.toggle("throw-mode", nextMode);
	if (!nextMode) {
		endToyDrag(false);
	}
}

async function loadBackgrounds() {
	try {
		const response = await fetch(resolveAssetUrl("public/backgrounds.json"));
		if (!response.ok) {
			return fallbackBackgrounds;
		}
		const parsed = await response.json();
		if (!Array.isArray(parsed)) {
			return fallbackBackgrounds;
		}
		return parsed.map((entry) => {
			const { primaryUrl, backupUrl } = resolveAssetWithBackup(
				entry.url,
				entry.backupUrl || "",
			);
			return {
				...entry,
				url: primaryUrl,
				backupUrl,
			};
		});
	} catch {
		return fallbackBackgrounds;
	}
}

function getActiveBackground() {
	return (
		state.backgrounds.find((background) => background.id === state.backgroundId) ||
		state.backgrounds[0] ||
		fallbackBackgrounds[0]
	);
}

async function sampleDotColor(textureUrl, backupTextureUrl = "") {
	if (!textureUrl) {
		return "rgba(148, 163, 184, 0.9)";
	}
	return new Promise((resolve) => {
		const image = new Image();
		let attemptedBackup = false;
		const fallbackUrl = backupTextureUrl || "";

		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = 32;
			canvas.height = 32;
			const context = canvas.getContext("2d");
			if (!context) {
				resolve("rgba(148, 163, 184, 0.9)");
				return;
			}
			context.drawImage(image, 0, 0, 32, 32);
			const pixels = context.getImageData(0, 0, 32, 32).data;
			let total = 0;
			let count = 0;
			for (let i = 0; i < pixels.length; i += 4) {
				const r = pixels[i];
				const g = pixels[i + 1];
				const b = pixels[i + 2];
				const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
				total += luminance;
				count += 1;
			}
				const average = total / Math.max(1, count);
				resolve(average > 0.6 ? "rgba(30, 41, 59, 0.7)" : "rgba(241, 245, 249, 0.8)");
			};
			image.onerror = () => {
				if (!attemptedBackup && fallbackUrl && fallbackUrl !== textureUrl) {
					attemptedBackup = true;
					image.src = fallbackUrl;
					return;
				}
				resolve("rgba(148, 163, 184, 0.9)");
			};
			image.src = textureUrl;
	});
}

function applyBackgroundStyles(background) {
	if (!background.url) {
		el.world.style.backgroundImage = `radial-gradient(${state.dotColor} 1.5px, transparent 1.5px)`;
		el.world.style.backgroundSize = "24px 24px";
		el.world.style.backgroundRepeat = "repeat";
		return;
	}

	const textureLayer = buildCssImageWithFallback(background.url, background.backupUrl);
	el.world.style.backgroundImage = `radial-gradient(${state.dotColor} 1.5px, transparent 1.5px), linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), ${textureLayer}`;
	el.world.style.backgroundSize = "24px 24px, 100% 100%, 256px 256px";
	el.world.style.backgroundRepeat = "repeat, no-repeat, repeat";
}

async function refreshBackground() {
	const token = ++backgroundRequestToken;
	const activeBackground = getActiveBackground();
	state.dotColor = await sampleDotColor(activeBackground.url, activeBackground.backupUrl);
	if (token !== backgroundRequestToken) {
		return;
	}
	applyBackgroundStyles(activeBackground);
}

function hideDragArtifacts() {
	el.dragOverlay.classList.remove("is-active");
	el.dragLine.setAttribute("x1", "0");
	el.dragLine.setAttribute("y1", "0");
	el.dragLine.setAttribute("x2", "0");
	el.dragLine.setAttribute("y2", "0");
	el.toyPreview.classList.remove("is-active");
}

function updateDragArtifacts() {
	if (!state.isDraggingThrow || !state.dragStartClient || !state.dragCurrentClient) {
		hideDragArtifacts();
		return;
	}

	const rect = getViewportRect();
	const toy = getToy(state.selectedToyId);
	const diameter = calculateToyDiameterPx(toy);
	const canvasPoint = toCanvasPoint(state.dragCurrentClient, rect, state.pan, state.zoom);

	el.toyPreview.style.left = `${canvasPoint.x - diameter / 2}px`;
	el.toyPreview.style.top = `${canvasPoint.y - diameter / 2}px`;
	el.toyPreview.style.width = `${diameter}px`;
	el.toyPreview.style.height = `${diameter}px`;
	setElementBackgroundImageWithFallback(
		el.toyPreview,
		toy.assetUrl,
		toy.backupAssetUrl,
	);
	el.toyPreview.classList.add("is-active");

	el.dragLine.setAttribute("x1", `${state.dragStartClient.x - rect.left}`);
	el.dragLine.setAttribute("y1", `${state.dragStartClient.y - rect.top}`);
	el.dragLine.setAttribute("x2", `${state.dragCurrentClient.x - rect.left}`);
	el.dragLine.setAttribute("y2", `${state.dragCurrentClient.y - rect.top}`);
	el.dragOverlay.classList.add("is-active");
}

function updateToyElementPosition(toy) {
	toy.elem.style.left = `${toy.x - toy.radius}px`;
	toy.elem.style.top = `${toy.y - toy.radius}px`;
	toy.elem.style.width = `${toy.diameter}px`;
	toy.elem.style.height = `${toy.diameter}px`;
}

function spawnToy(launch, toyDefinition) {
	const toyElement = document.createElement("div");
	toyElement.className = "toy-instance";
	setElementBackgroundImageWithFallback(
		toyElement,
		toyDefinition.assetUrl,
		toyDefinition.backupAssetUrl,
	);

	const toyState = {
		id: ++state.toyCounter,
		toyId: toyDefinition.id,
		...launch,
		elem: toyElement,
	};

	updateToyElementPosition(toyState);
	el.world.appendChild(toyElement);
	requestAnimationFrame(() => {
		toyElement.classList.add("is-visible");
	});
	state.toys.push(toyState);
}

function launchToy(startClient, endClient) {
	const toyDefinition = getToy(state.selectedToyId);
	const launch = computeToyLaunch({
		startClient,
		endClient,
		viewportRect: getViewportRect(),
		pan: state.pan,
		zoom: state.zoom,
		toy: toyDefinition,
	});
	if (!launch) {
		return;
	}
	spawnToy(launch, toyDefinition);
}

function beginToyDrag(clientPoint) {
	if (!state.throwMode) {
		return;
	}
	state.isDraggingThrow = true;
	state.dragStartClient = { ...clientPoint };
	state.dragCurrentClient = { ...clientPoint };
	updateDragArtifacts();
}

function endToyDrag(shouldLaunch) {
	if (!state.isDraggingThrow) {
		return;
	}
	const start = state.dragStartClient;
	const end = state.dragCurrentClient;
	state.isDraggingThrow = false;
	state.throwPointerId = null;
	state.dragStartClient = null;
	state.dragCurrentClient = null;
	hideDragArtifacts();
	if (shouldLaunch && start && end) {
		launchToy(start, end);
	}
}

function setPanAnchor(clientPoint) {
	state.panDragStart = {
		clientX: clientPoint.x,
		clientY: clientPoint.y,
		panX: state.pan.x,
		panY: state.pan.y,
	};
}

function beginPan(clientPoint) {
	state.isPanning = true;
	setPanAnchor(clientPoint);
	el.viewport.classList.add("is-panning");
}

function stopPan() {
	state.isPanning = false;
	state.panPointerId = null;
	state.panDragStart = null;
	el.viewport.classList.remove("is-panning");
}

function updatePan(clientPoint) {
	if (!state.isPanning || !state.panDragStart) {
		return;
	}
	state.pan = clampPan(
		{
			x: state.panDragStart.panX + (clientPoint.x - state.panDragStart.clientX),
			y: state.panDragStart.panY + (clientPoint.y - state.panDragStart.clientY),
		},
		state.zoom,
	);
	renderTransform();
}

function isTouchLikePointer(pointerType) {
	return pointerType === "touch" || pointerType === "pen";
}

function countActiveTouchPointers() {
	let count = 0;
	for (const pointer of activePointers.values()) {
		if (isTouchLikePointer(pointer.type)) {
			count += 1;
		}
	}
	return count;
}

function getTouchCentroid() {
	let totalX = 0;
	let totalY = 0;
	let count = 0;
	for (const pointer of activePointers.values()) {
		if (!isTouchLikePointer(pointer.type)) {
			continue;
		}
		totalX += pointer.x;
		totalY += pointer.y;
		count += 1;
	}
	if (!count) {
		return null;
	}
	return { x: totalX / count, y: totalY / count };
}

function capturePointer(pointerId) {
	try {
		el.viewport.setPointerCapture(pointerId);
	} catch {
		// no-op for unsupported pointer capture paths
	}
}

function releasePointer(pointerId) {
	try {
		if (el.viewport.hasPointerCapture(pointerId)) {
			el.viewport.releasePointerCapture(pointerId);
		}
	} catch {
		// no-op for unsupported pointer capture paths
	}
}

function stepToys(dtSeconds) {
	for (let i = state.toys.length - 1; i >= 0; i -= 1) {
		const toyState = state.toys[i];
		const toyDefinition = getToy(toyState.toyId);
		const { next, remove } = stepToyPhysics(
			toyState,
			dtSeconds,
			GRID_PIXEL_SIZE,
			toyDefinition.physics,
		);

		if (remove) {
			try {
				toyState.elem.remove();
			} catch {
				// no-op cleanup
			}
			state.toys.splice(i, 1);
			continue;
		}

		state.toys[i] = next;
		updateToyElementPosition(next);
	}
}

function renderDog() {
	const dogDefinition = getDog(state.selectedDogId);
	const spriteHeight = DOG_SPRITE_TARGET_HEIGHT * (dogDefinition.visualScale || 1);
	const primaryFrame =
		dogDefinition.frames[state.dog.frameIndex] || dogDefinition.frames[0] || "";
	const backupFrame =
		dogDefinition.backupFrames?.[state.dog.frameIndex] ||
		dogDefinition.backupFrames?.[0] ||
		"";

	el.dogSprite.style.left = `${state.dog.x - spriteHeight / 2}px`;
	el.dogSprite.style.top = `${state.dog.y - spriteHeight / 2}px`;
	el.dogSprite.style.width = `${spriteHeight}px`;
	el.dogSprite.style.height = `${spriteHeight}px`;
	el.dogSprite.style.transform = `scaleX(${state.dog.flip ? -1 : 1})`;
	if (el.dogImage.dataset.primarySrc !== primaryFrame || el.dogImage.dataset.backupSrc !== backupFrame) {
		el.dogImage.dataset.primarySrc = primaryFrame;
		el.dogImage.dataset.backupSrc = backupFrame;
		el.dogImage.onerror = null;
		if (backupFrame && backupFrame !== primaryFrame) {
			el.dogImage.onerror = () => {
				if (el.dogImage.src !== backupFrame) {
					el.dogImage.src = backupFrame;
				}
			};
		}
		el.dogImage.src = primaryFrame;
	}
}

function stepDog(dtMs) {
	const dogDefinition = getDog(state.selectedDogId);
	const spriteHeight = DOG_SPRITE_TARGET_HEIGHT * (dogDefinition.visualScale || 1);
	state.dog = stepDogState({
		previous: state.dog,
		dog: dogDefinition,
		toys: state.toys,
		dtMs,
		zoom: state.zoom,
		pan: state.pan,
		viewportRect: getViewportRect(),
		worldSizePx: GRID_PIXEL_SIZE,
		spriteHeight,
	});
	renderDog();
}

function animationFrame(now) {
	const dtMs = Math.min(48, now - frameLastTime);
	frameLastTime = now;
	stepSimulation(dtMs);
	requestAnimationFrame(animationFrame);
}

function stepSimulation(dtMs) {
	stepToys(dtMs / 1000);
	stepDog(dtMs);
}

function handlePointerDown(event) {
	if (isViewportHudControlTarget(event.target)) {
		return;
	}
	if (
		state.isMobileLayout &&
		state.mobilePanelOpen &&
		event.target instanceof Element &&
		!el.controlPanel.contains(event.target)
	) {
		setMobilePanelOpen(false);
	}
	const point = { x: event.clientX, y: event.clientY };
	activePointers.set(event.pointerId, {
		x: point.x,
		y: point.y,
		type: event.pointerType,
	});

	el.viewport.focus();

	if (!isTouchLikePointer(event.pointerType)) {
		if (state.isSpacePressed || event.button === 1) {
			state.panPointerId = event.pointerId;
			beginPan(point);
			capturePointer(event.pointerId);
			event.preventDefault();
			return;
		}

		if (event.button === 0 && state.throwMode) {
			state.throwPointerId = event.pointerId;
			beginToyDrag(point);
			capturePointer(event.pointerId);
			event.preventDefault();
		}
		return;
	}

	const touchCount = countActiveTouchPointers();
	if (touchCount > 1 || state.isSpacePressed) {
		if (state.isDraggingThrow) {
			endToyDrag(false);
		}
		const centroid = getTouchCentroid() || point;
		if (!state.isPanning) {
			beginPan(centroid);
		} else {
			setPanAnchor(centroid);
		}
		state.panPointerId = event.pointerId;
		capturePointer(event.pointerId);
		event.preventDefault();
		return;
	}

	if (state.throwMode) {
		state.throwPointerId = event.pointerId;
		beginToyDrag(point);
		capturePointer(event.pointerId);
		event.preventDefault();
	}
}

function handlePointerMove(event) {
	const point = { x: event.clientX, y: event.clientY };
	const active = activePointers.get(event.pointerId);
	if (active) {
		active.x = point.x;
		active.y = point.y;
	}

	if (state.isPanning) {
		if (isTouchLikePointer(event.pointerType)) {
			const centroid = getTouchCentroid();
			if (centroid) {
				updatePan(centroid);
			}
			event.preventDefault();
		} else if (event.pointerId === state.panPointerId) {
			updatePan(point);
		}
	}

	if (state.isDraggingThrow && event.pointerId === state.throwPointerId) {
		state.dragCurrentClient = point;
		updateDragArtifacts();
		if (isTouchLikePointer(event.pointerType)) {
			event.preventDefault();
		}
	}
}

function finalizePointer(event, shouldLaunch) {
	const point = { x: event.clientX, y: event.clientY };
	const isTouchLike = isTouchLikePointer(event.pointerType);

	if (state.isDraggingThrow && event.pointerId === state.throwPointerId) {
		state.dragCurrentClient = point;
		endToyDrag(shouldLaunch);
	}

	activePointers.delete(event.pointerId);
	releasePointer(event.pointerId);

	if (!state.isPanning) {
		return;
	}

	if (!isTouchLike) {
		if (event.pointerId === state.panPointerId) {
			stopPan();
		}
		return;
	}

	const touchCount = countActiveTouchPointers();
	if (touchCount === 0) {
		stopPan();
		return;
	}

	const centroid = getTouchCentroid();
	if (centroid) {
		setPanAnchor(centroid);
	}
}

function handlePointerUp(event) {
	finalizePointer(event, true);
}

function handlePointerCancel(event) {
	finalizePointer(event, false);
}

function handleWheel(event) {
	if (isViewportHudControlTarget(event.target)) {
		return;
	}

	if (event.ctrlKey || event.metaKey) {
		event.preventDefault();
		const delta = -event.deltaY;
		const factor = Math.pow(1.1, delta / 100);
		const previousZoom = state.zoom;
		const nextZoom = clampZoom(previousZoom * factor);
		zoomAroundVisibleGridCenter(nextZoom, previousZoom);
		return;
	}

	if (state.isSpacePressed) {
		return;
	}

	event.preventDefault();
	state.pan = clampPan(
		{
			x: state.pan.x - event.deltaX,
			y: state.pan.y - event.deltaY,
		},
		state.zoom,
	);
	renderTransform();
}

function handleKeyDown(event) {
	const targetTag = event.target && "tagName" in event.target ? event.target.tagName : "";
	const isInput = targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT";

	if (event.code === "Space" && !isInput) {
		state.isSpacePressed = true;
		event.preventDefault();
	}
	if (event.key === "Escape") {
		endToyDrag(false);
		setMobilePanelOpen(false);
	}
	if ((event.key === "m" || event.key === "M") && !isInput) {
		setMobilePanelOpen(!state.mobilePanelOpen);
	}
}

function handleKeyUp(event) {
	if (event.code === "Space") {
		state.isSpacePressed = false;
	}
}

function handleResize() {
	state.pan = clampPan(state.pan, state.zoom);
	renderTransform();
}

function wireControls() {
	const dogOptions = getDogOptions();
	const toyOptions = getToyOptions();
	setSelectOptions(el.dogSelect, dogOptions, state.selectedDogId);
	setSelectOptions(el.toySelect, toyOptions, state.selectedToyId);
	renderPicker(el.dogPicker, dogOptions, state.selectedDogId, {
		kind: "dog",
		showDescription: true,
	});
	renderPicker(el.toyPicker, toyOptions, state.selectedToyId, { kind: "toy" });
	updatePickerLabel(el.dogLabel, dogOptions, state.selectedDogId, "Dog");
	updatePickerLabel(el.toyLabel, toyOptions, state.selectedToyId, "Toy");

	el.dogPicker.addEventListener("click", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		const button = target?.closest("button[data-value]");
		if (!button || !el.dogPicker.contains(button)) {
			return;
		}
		const selectedId = button.dataset.value || "";
		if (!selectedId || selectedId === state.selectedDogId) {
			return;
		}
		state.selectedDogId = selectedId;
		el.dogSelect.value = selectedId;
		updatePickerSelection(el.dogPicker, selectedId);
		updatePickerLabel(el.dogLabel, dogOptions, selectedId, "Dog");
	});

	el.toyPicker.addEventListener("click", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		const button = target?.closest("button[data-value]");
		if (!button || !el.toyPicker.contains(button)) {
			return;
		}
		const selectedId = button.dataset.value || "";
		if (!selectedId || selectedId === state.selectedToyId) {
			return;
		}
		state.selectedToyId = selectedId;
		el.toySelect.value = selectedId;
		updatePickerSelection(el.toyPicker, selectedId);
		updatePickerLabel(el.toyLabel, toyOptions, selectedId, "Toy");
		updateDragArtifacts();
	});

	el.backgroundPicker.addEventListener("click", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		const button = target?.closest("button[data-value]");
		if (!button || !el.backgroundPicker.contains(button)) {
			return;
		}
		const selectedId = button.dataset.value || "";
		if (!selectedId || selectedId === state.backgroundId) {
			return;
		}
		state.backgroundId = selectedId;
		el.textureSelect.value = selectedId;
		updatePickerSelection(el.backgroundPicker, selectedId);
		updatePickerLabel(el.backgroundLabel, state.backgrounds, selectedId, "Background");
		refreshBackground();
	});

	el.dogSelect.addEventListener("change", () => {
		state.selectedDogId = el.dogSelect.value;
		updatePickerSelection(el.dogPicker, state.selectedDogId);
		updatePickerLabel(el.dogLabel, dogOptions, state.selectedDogId, "Dog");
	});

	el.toySelect.addEventListener("change", () => {
		state.selectedToyId = el.toySelect.value;
		updatePickerSelection(el.toyPicker, state.selectedToyId);
		updatePickerLabel(el.toyLabel, toyOptions, state.selectedToyId, "Toy");
		updateDragArtifacts();
	});

	el.textureSelect.addEventListener("change", () => {
		state.backgroundId = el.textureSelect.value;
		updatePickerSelection(el.backgroundPicker, state.backgroundId);
		updatePickerLabel(
			el.backgroundLabel,
			state.backgrounds,
			state.backgroundId,
			"Background",
		);
		refreshBackground();
	});

	el.toggleThrow.addEventListener("click", () => {
		setThrowMode(!state.throwMode);
	});
	el.mobileThrowToggle.addEventListener("click", () => {
		setThrowMode(!state.throwMode);
	});
	const toggleMobilePanel = () => {
		setMobilePanelOpen(!state.mobilePanelOpen);
	};
	el.mobilePanelToggle.addEventListener("click", toggleMobilePanel);
	el.mobileControlsFab.addEventListener("click", toggleMobilePanel);

	el.centerView.addEventListener("click", () => {
		centerCanvas(state.zoom);
	});

	el.zoomOut.addEventListener("click", () => zoomByDelta(-0.1));
	el.zoomIn.addEventListener("click", () => zoomByDelta(0.1));
	el.zoomReset.addEventListener("click", () => {
		centerCanvas(1);
	});
}

function wireViewportEvents() {
	el.viewport.addEventListener("wheel", handleWheel, { passive: false });
	el.viewport.addEventListener("pointerdown", handlePointerDown);
	el.viewport.addEventListener("pointermove", handlePointerMove);
	el.viewport.addEventListener("pointerup", handlePointerUp);
	el.viewport.addEventListener("pointercancel", handlePointerCancel);
	el.viewport.addEventListener("contextmenu", (event) => {
		if (state.throwMode || state.isPanning) {
			event.preventDefault();
		}
	});

	window.addEventListener("pointermove", handlePointerMove);
	window.addEventListener("pointerup", handlePointerUp);
	window.addEventListener("pointercancel", handlePointerCancel);
	window.addEventListener("keydown", handleKeyDown);
	window.addEventListener("keyup", handleKeyUp);
	window.addEventListener("resize", handleResize);
	const handleMobileMediaChange = (event) => {
		syncMobileLayout(event.matches);
		centerCanvas(state.zoom);
	};
	if (typeof mobileLayoutMedia.addEventListener === "function") {
		mobileLayoutMedia.addEventListener("change", handleMobileMediaChange);
	} else if (typeof mobileLayoutMedia.addListener === "function") {
		mobileLayoutMedia.addListener(handleMobileMediaChange);
	}
}

function roundTo2(value) {
	return Math.round(value * 100) / 100;
}

function renderGameToText() {
	const payload = {
		coordinateSystem: {
			origin: "top-left",
			axes: "+x right, +y down",
			worldSizePx: GRID_PIXEL_SIZE,
		},
		camera: {
			zoom: roundTo2(state.zoom),
			panX: roundTo2(state.pan.x),
			panY: roundTo2(state.pan.y),
		},
		dog: {
			x: roundTo2(state.dog.x),
			y: roundTo2(state.dog.y),
			flip: state.dog.flip,
			frame: state.dog.frameIndex,
		},
		toys: state.toys.map((toyState) => ({
			id: toyState.id,
			x: roundTo2(toyState.x),
			y: roundTo2(toyState.y),
			vx: roundTo2(toyState.vx),
			vy: roundTo2(toyState.vy),
		})),
		throwMode: state.throwMode,
		mobilePanelOpen: state.mobilePanelOpen,
	};
	return JSON.stringify(payload);
}

function exposeTestHooks() {
	window.render_game_to_text = renderGameToText;
	window.advanceTime = (ms) => {
		const frameMs = 1000 / 60;
		const steps = Math.max(1, Math.round(ms / frameMs));
		for (let i = 0; i < steps; i += 1) {
			stepSimulation(frameMs);
		}
	};
}

async function initBackgroundSelect() {
	state.backgrounds = await loadBackgrounds();
	const hasGrass = state.backgrounds.some((background) => background.id === "grass");
	state.backgroundId = hasGrass ? "grass" : state.backgrounds[0]?.id || "none";
	setSelectOptions(el.textureSelect, state.backgrounds, state.backgroundId);
	renderPicker(el.backgroundPicker, state.backgrounds, state.backgroundId, {
		kind: "background",
	});
	updatePickerLabel(el.backgroundLabel, state.backgrounds, state.backgroundId, "Background");
	await refreshBackground();
}

async function init() {
	wireControls();
	wireViewportEvents();
	syncMobileLayout(mobileLayoutMedia.matches);
	setThrowMode(true);
	centerCanvas(1);
	await initBackgroundSelect();
	renderDog();
	exposeTestHooks();
	requestAnimationFrame(animationFrame);
}

init();
