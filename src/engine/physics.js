import { BASE_TOY_INCHES, BASE_TOY_SCALE, GRID_SIZE, INCHES_PER_GRID } from "../constants.js";

export function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

export function calculateToyDiameterPx(toyDefinition) {
	const diameterScale = BASE_TOY_SCALE * (toyDefinition?.diameterMultiplier ?? 1);
	const diameterInches = BASE_TOY_INCHES * diameterScale;
	return (diameterInches / INCHES_PER_GRID) * GRID_SIZE;
}

export function toCanvasPoint(clientPoint, viewportRect, pan, zoom) {
	return {
		x: (clientPoint.x - viewportRect.left - pan.x) / zoom,
		y: (clientPoint.y - viewportRect.top - pan.y) / zoom,
	};
}

export function computeToyLaunch({
	startClient,
	endClient,
	viewportRect,
	pan,
	zoom,
	toy,
}) {
	const launchProfile = toy.launch;
	const startCanvas = toCanvasPoint(startClient, viewportRect, pan, zoom);
	const endCanvas = toCanvasPoint(endClient, viewportRect, pan, zoom);

	const dxScreen = startClient.x - endClient.x;
	const dyScreen = startClient.y - endClient.y;
	const distScreen = Math.hypot(dxScreen, dyScreen);

	if (distScreen < launchProfile.minDragPx) {
		return null;
	}

	const dxCanvas = startCanvas.x - endCanvas.x;
	const dyCanvas = startCanvas.y - endCanvas.y;
	const distCanvas = Math.hypot(dxCanvas, dyCanvas);
	if (distCanvas < 0.0001) {
		return null;
	}

	const normX = dxCanvas / distCanvas;
	const normY = dyCanvas / distCanvas;
	const maxDist = Math.hypot(viewportRect.width, viewportRect.height);
	const speedScale = clamp(distScreen / Math.max(1, maxDist), 0, 1);
	const screenSpeed =
		launchProfile.minScreenSpeed +
		(launchProfile.maxScreenSpeed - launchProfile.minScreenSpeed) * speedScale;
	const canvasSpeed = screenSpeed / Math.max(0.0001, zoom);
	const diameter = Math.round(calculateToyDiameterPx(toy));

	return {
		x: endCanvas.x,
		y: endCanvas.y,
		vx: normX * canvasSpeed,
		vy: normY * canvasSpeed,
		diameter,
		radius: diameter / 2,
	};
}

export function stepToyPhysics(toyState, dtSeconds, worldSizePx, physicsProfile) {
	const damping = physicsProfile.damping;
	const restitution = physicsProfile.restitution;
	const wallFriction = physicsProfile.wallFriction;
	const speedThreshold = physicsProfile.speedThreshold;

	const next = {
		...toyState,
		x: toyState.x + toyState.vx * dtSeconds,
		y: toyState.y + toyState.vy * dtSeconds,
	};

	const dampFactor = Math.exp(-damping * dtSeconds);
	next.vx *= dampFactor;
	next.vy *= dampFactor;

	const minX = next.radius;
	const maxX = worldSizePx - next.radius;
	const minY = next.radius;
	const maxY = worldSizePx - next.radius;

	if (next.x < minX) {
		next.x = minX;
		next.vx = Math.abs(next.vx) * restitution;
		next.vy *= wallFriction;
	} else if (next.x > maxX) {
		next.x = maxX;
		next.vx = -Math.abs(next.vx) * restitution;
		next.vy *= wallFriction;
	}

	if (next.y < minY) {
		next.y = minY;
		next.vy = Math.abs(next.vy) * restitution;
		next.vx *= wallFriction;
	} else if (next.y > maxY) {
		next.y = maxY;
		next.vy = -Math.abs(next.vy) * restitution;
		next.vx *= wallFriction;
	}

	const speed = Math.hypot(next.vx, next.vy);
	const outOfBounds =
		next.x < -200 ||
		next.x > worldSizePx + 200 ||
		next.y < -200 ||
		next.y > worldSizePx + 200;

	return {
		next,
		remove: outOfBounds || speed < speedThreshold,
	};
}
