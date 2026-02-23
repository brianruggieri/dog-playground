import { DOG_SPRITE_TARGET_HEIGHT, GRID_PIXEL_SIZE } from "./constants.js";
import { getDog, getDogOptions } from "./catalog/dogs.js";
import { getToy, getToyOptions } from "./catalog/toys.js";
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
	{ id: "dirt", name: "Dirt", url: "/public/backgrounds/dirt-tile.png" },
	{ id: "grass", name: "Grass", url: "/public/backgrounds/grass-tile.png" },
	{ id: "gravel", name: "Gravel", url: "/public/backgrounds/gravel-tile.png" },
	{ id: "sand", name: "Sand", url: "/public/backgrounds/sand-tile.png" },
	{ id: "tile", name: "Tile", url: "/public/backgrounds/tile-tile.png" },
];

const el = {
	viewport: document.getElementById("viewport"),
	world: document.getElementById("world"),
	dogSprite: document.getElementById("dog-sprite"),
	dogImage: document.getElementById("dog-image"),
	textureSelect: document.getElementById("texture-select"),
	dogSelect: document.getElementById("dog-select"),
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
	isDraggingThrow: false,
	dragStartClient: null,
	dragCurrentClient: null,
	toys: [],
	toyCounter: 0,
	dog: createInitialDogState(GRID_PIXEL_SIZE),
};

let backgroundRequestToken = 0;
let frameLastTime = performance.now();

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

function getViewportRect() {
	return el.viewport.getBoundingClientRect();
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

function setThrowMode(nextMode) {
	state.throwMode = nextMode;
	el.toggleThrow.textContent = `Throw Mode: ${nextMode ? "On" : "Off"}`;
	el.viewport.classList.toggle("throw-mode", nextMode);
	if (!nextMode) {
		endToyDrag(false);
	}
}

async function loadBackgrounds() {
	try {
		const response = await fetch("/public/backgrounds.json");
		if (!response.ok) {
			return fallbackBackgrounds;
		}
		const parsed = await response.json();
		if (!Array.isArray(parsed)) {
			return fallbackBackgrounds;
		}
		return parsed;
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

async function sampleDotColor(textureUrl) {
	if (!textureUrl) {
		return "rgba(148, 163, 184, 0.9)";
	}
	return new Promise((resolve) => {
		const image = new Image();
		image.src = textureUrl;
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
		image.onerror = () => resolve("rgba(148, 163, 184, 0.9)");
	});
}

function applyBackgroundStyles(background) {
	if (!background.url) {
		el.world.style.backgroundImage = `radial-gradient(${state.dotColor} 1.5px, transparent 1.5px)`;
		el.world.style.backgroundSize = "24px 24px";
		el.world.style.backgroundRepeat = "repeat";
		return;
	}

	el.world.style.backgroundImage = `radial-gradient(${state.dotColor} 1.5px, transparent 1.5px), linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), url(${background.url})`;
	el.world.style.backgroundSize = "24px 24px, 100% 100%, 256px 256px";
	el.world.style.backgroundRepeat = "repeat, no-repeat, repeat";
}

async function refreshBackground() {
	const token = ++backgroundRequestToken;
	const activeBackground = getActiveBackground();
	state.dotColor = await sampleDotColor(activeBackground.url);
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
	el.toyPreview.style.backgroundImage = `url('${toy.assetUrl}')`;
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
	toyElement.style.backgroundImage = `url('${toyDefinition.assetUrl}')`;

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
	state.dragStartClient = null;
	state.dragCurrentClient = null;
	hideDragArtifacts();
	if (shouldLaunch && start && end) {
		launchToy(start, end);
	}
}

function beginPan(clientPoint) {
	state.isPanning = true;
	state.panDragStart = {
		clientX: clientPoint.x,
		clientY: clientPoint.y,
		panX: state.pan.x,
		panY: state.pan.y,
	};
	el.viewport.classList.add("is-panning");
}

function stopPan() {
	state.isPanning = false;
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

	el.dogSprite.style.left = `${state.dog.x - spriteHeight / 2}px`;
	el.dogSprite.style.top = `${state.dog.y - spriteHeight / 2}px`;
	el.dogSprite.style.width = `${spriteHeight}px`;
	el.dogSprite.style.height = `${spriteHeight}px`;
	el.dogSprite.style.transform = `scaleX(${state.dog.flip ? -1 : 1})`;
	el.dogImage.src = dogDefinition.frames[state.dog.frameIndex] || dogDefinition.frames[0];
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
	stepToys(dtMs / 1000);
	stepDog(dtMs);
	requestAnimationFrame(animationFrame);
}

function handleMouseDown(event) {
	el.viewport.focus();
	if (state.isSpacePressed || event.button === 1) {
		beginPan({ x: event.clientX, y: event.clientY });
		event.preventDefault();
		return;
	}

	if (event.button !== 0 || !state.throwMode) {
		return;
	}

	beginToyDrag({ x: event.clientX, y: event.clientY });
	event.preventDefault();
}

function handleMouseMove(event) {
	if (state.isPanning) {
		updatePan({ x: event.clientX, y: event.clientY });
	}
	if (state.isDraggingThrow) {
		state.dragCurrentClient = { x: event.clientX, y: event.clientY };
		updateDragArtifacts();
	}
}

function handleMouseUp(event) {
	if (state.isPanning) {
		stopPan();
	}
	if (state.isDraggingThrow && event.button === 0) {
		state.dragCurrentClient = { x: event.clientX, y: event.clientY };
		endToyDrag(true);
	}
}

function handleTouchStart(event) {
	if (event.touches.length > 1 || state.isSpacePressed) {
		const touch = event.touches[0];
		beginPan({ x: touch.clientX, y: touch.clientY });
		event.preventDefault();
		return;
	}
	if (!state.throwMode) {
		return;
	}
	const touch = event.touches[0];
	beginToyDrag({ x: touch.clientX, y: touch.clientY });
	event.preventDefault();
}

function handleTouchMove(event) {
	if (state.isPanning && event.touches.length > 0) {
		const touch = event.touches[0];
		updatePan({ x: touch.clientX, y: touch.clientY });
		event.preventDefault();
		return;
	}
	if (state.isDraggingThrow && event.touches.length === 1) {
		const touch = event.touches[0];
		state.dragCurrentClient = { x: touch.clientX, y: touch.clientY };
		updateDragArtifacts();
		event.preventDefault();
	}
}

function handleTouchEnd(event) {
	if (state.isDraggingThrow) {
		const changedTouch = event.changedTouches[0];
		if (changedTouch) {
			state.dragCurrentClient = {
				x: changedTouch.clientX,
				y: changedTouch.clientY,
			};
		}
		endToyDrag(true);
	}
	if (event.touches.length === 0) {
		stopPan();
	}
}

function handleWheel(event) {
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
	setSelectOptions(el.dogSelect, getDogOptions(), state.selectedDogId);
	setSelectOptions(el.toySelect, getToyOptions(), state.selectedToyId);

	el.dogSelect.addEventListener("change", () => {
		state.selectedDogId = el.dogSelect.value;
	});

	el.toySelect.addEventListener("change", () => {
		state.selectedToyId = el.toySelect.value;
		updateDragArtifacts();
	});

	el.textureSelect.addEventListener("change", () => {
		state.backgroundId = el.textureSelect.value;
		refreshBackground();
	});

	el.toggleThrow.addEventListener("click", () => {
		setThrowMode(!state.throwMode);
	});

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
	el.viewport.addEventListener("mousedown", handleMouseDown);
	el.viewport.addEventListener("touchstart", handleTouchStart, { passive: false });
	el.viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
	el.viewport.addEventListener("touchend", handleTouchEnd, { passive: false });
	el.viewport.addEventListener("touchcancel", handleTouchEnd, { passive: false });
	el.viewport.addEventListener("contextmenu", (event) => {
		if (state.throwMode || state.isPanning) {
			event.preventDefault();
		}
	});

	window.addEventListener("mousemove", handleMouseMove);
	window.addEventListener("mouseup", handleMouseUp);
	window.addEventListener("keydown", handleKeyDown);
	window.addEventListener("keyup", handleKeyUp);
	window.addEventListener("resize", handleResize);
}

async function initBackgroundSelect() {
	state.backgrounds = await loadBackgrounds();
	const hasGrass = state.backgrounds.some((background) => background.id === "grass");
	state.backgroundId = hasGrass ? "grass" : state.backgrounds[0]?.id || "none";
	setSelectOptions(el.textureSelect, state.backgrounds, state.backgroundId);
	await refreshBackground();
}

async function init() {
	wireControls();
	wireViewportEvents();
	setThrowMode(true);
	centerCanvas(1);
	await initBackgroundSelect();
	renderDog();
	requestAnimationFrame(animationFrame);
}

init();
