import { clamp } from "./physics.js";

function angleDistance(a, b) {
	const delta = Math.abs(a - b);
	return Math.min(delta, 360 - delta);
}

export function calculateVisibleWorldBounds(viewportRect, pan, zoom) {
	return {
		left: -pan.x / zoom,
		top: -pan.y / zoom,
		right: (viewportRect.width - pan.x) / zoom,
		bottom: (viewportRect.height - pan.y) / zoom,
	};
}

export function pickEdgeTarget(bounds, rng = Math.random) {
	const inset = 40;
	const offset = 28;
	const edge = Math.floor(rng() * 4);
	const pickRandom = (min, max) => min + rng() * Math.max(1, max - min);

	if (edge === 0) {
		return {
			x: pickRandom(bounds.left + inset, bounds.right - inset),
			y: bounds.top - offset,
		};
	}
	if (edge === 1) {
		return {
			x: bounds.right + offset,
			y: pickRandom(bounds.top + inset, bounds.bottom - inset),
		};
	}
	if (edge === 2) {
		return {
			x: pickRandom(bounds.left + inset, bounds.right - inset),
			y: bounds.bottom + offset,
		};
	}
	return {
		x: bounds.left - offset,
		y: pickRandom(bounds.top + inset, bounds.bottom - inset),
	};
}

export function createInitialDogState(worldSizePx) {
	const center = worldSizePx / 2;
	return {
		x: center,
		y: center,
		frameIndex: 0,
		flip: false,
		angle: 0,
		target: {
			x: center,
			y: center,
			hasTarget: false,
		},
		visible: true,
	};
}

export function selectSpriteFrame(normalizedAngle, dogDefinition) {
	if (normalizedAngle >= 225 && normalizedAngle <= 315) {
		return {
			frameIndex: dogDefinition.upwardFrameIndex ?? 0,
			flip: false,
		};
	}

	const frameAngles =
		dogDefinition.frameAngles && dogDefinition.frameAngles.length
			? dogDefinition.frameAngles
			: dogDefinition.frames.map(() => 0);

	let frameIndex = 0;
	let flip = false;
	let minDelta = Number.POSITIVE_INFINITY;

	for (let i = 0; i < frameAngles.length; i += 1) {
		const frameAngle = frameAngles[i];
		const directDelta = angleDistance(frameAngle, normalizedAngle);
		const flippedDelta = angleDistance((frameAngle + 180) % 360, normalizedAngle);

		if (directDelta < minDelta) {
			minDelta = directDelta;
			frameIndex = i;
			flip = false;
		}
		if (flippedDelta < minDelta) {
			minDelta = flippedDelta;
			frameIndex = i;
			flip = true;
		}
	}

	return { frameIndex, flip };
}

export function stepDogState({
	previous,
	dog,
	toys,
	dtMs,
	zoom,
	pan,
	viewportRect,
	worldSizePx,
	spriteHeight,
}) {
	if (!dog) {
		return previous;
	}

	const movement = dog.movement;
	let dynamicTarget = false;
	let latestToy = null;

	const safeMin = spriteHeight * movement.targetInsetRatio;
	const safeMax = worldSizePx - safeMin;
	let target = previous.target;

	if (toys.length > 0) {
		latestToy = toys[toys.length - 1];
		target = {
			x: clamp(latestToy.x, safeMin, safeMax),
			y: clamp(latestToy.y, safeMin, safeMax),
			hasTarget: true,
		};
		dynamicTarget = true;
	} else if (!target.hasTarget) {
		const bounds = calculateVisibleWorldBounds(viewportRect, pan, zoom);
		target = {
			...pickEdgeTarget(bounds),
			hasTarget: true,
		};
	}

	const dx = target.x - previous.x;
	const dy = target.y - previous.y;
	const distance = Math.hypot(dx, dy);

	let speed = movement.baseSpeed;
	if (dynamicTarget && latestToy) {
		const toyScreenSpeed = Math.hypot(latestToy.vx, latestToy.vy);
		const canvasPxPerMs = toyScreenSpeed / Math.max(0.0001, zoom) / 1000;
		speed = clamp(canvasPxPerMs, movement.minChaseSpeed, movement.maxChaseSpeed);
	}

	const stepDistance = Math.min(distance, speed * dtMs);
	const nextX = distance > 1 ? previous.x + (dx / distance) * stepDistance : previous.x;
	const nextY = distance > 1 ? previous.y + (dy / distance) * stepDistance : previous.y;

	const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	const normalizedAngle = (angle + 360) % 360;
	const { frameIndex, flip } = selectSpriteFrame(normalizedAngle, dog);

	const clampedX = clamp(nextX, safeMin, safeMax);
	const clampedY = clamp(nextY, safeMin, safeMax);

	const nextTarget = { ...target };
	if (dynamicTarget && latestToy) {
		const distanceToToy = Math.hypot(latestToy.x - clampedX, latestToy.y - clampedY);
		if (distanceToToy < spriteHeight * movement.catchDistanceRatio) {
			nextTarget.hasTarget = false;
		}
	} else if (
		clampedX <= safeMin + 1 ||
		clampedX >= safeMax - 1 ||
		clampedY <= safeMin + 1 ||
		clampedY >= safeMax - 1
	) {
		nextTarget.hasTarget = false;
	}

	return {
		...previous,
		x: clampedX,
		y: clampedY,
		frameIndex,
		flip,
		angle: normalizedAngle,
		target: nextTarget,
		visible: true,
	};
}
