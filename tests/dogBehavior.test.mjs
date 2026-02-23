import test from "node:test";
import assert from "node:assert/strict";
import { selectSpriteFrame, stepDogState } from "../src/engine/dogBehavior.js";

function createDogDefinition(overrides = {}) {
	return {
		id: "test-dog",
		name: "Test Dog",
		frames: ["/public/dogs/dog-01.webp", "/public/dogs/dog-02.webp", "/public/dogs/dog-03.webp", "/public/dogs/dog-04.webp"],
		frameAngles: [60, 90, 0, 270],
		upwardFrameIndex: 3,
		movement: {
			baseSpeed: 0.08,
			minChaseSpeed: 0.1,
			maxChaseSpeed: 0.8,
			targetInsetRatio: 0.5,
			catchDistanceRatio: 0.5,
		},
		...overrides,
	};
}

function createPreviousDogState(overrides = {}) {
	return {
		x: 100,
		y: 100,
		frameIndex: 0,
		flip: false,
		angle: 0,
		target: { x: 100, y: 100, hasTarget: false },
		visible: true,
		...overrides,
	};
}

function approxEqual(actual, expected, epsilon = 0.0001) {
	assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be within ${epsilon} of ${expected}`);
}

const baseStepArgs = {
	dtMs: 100,
	zoom: 1,
	pan: { x: 0, y: 0 },
	viewportRect: { width: 800, height: 600 },
	worldSizePx: 2000,
	spriteHeight: 100,
};

test("selectSpriteFrame keeps the upward frame when moving upward", () => {
	const dog = createDogDefinition();
	const frame = selectSpriteFrame(270, dog);
	assert.equal(frame.frameIndex, 3);
	assert.equal(frame.flip, false);
});

test("stepDogState returns previous state when dog definition is missing", () => {
	const previous = createPreviousDogState();
	const next = stepDogState({
		previous,
		dog: null,
		toys: [],
		...baseStepArgs,
	});
	assert.equal(next, previous);
});

test("stepDogState clamps chase speed to minChaseSpeed when toy is nearly stationary", () => {
	const previous = createPreviousDogState();
	const dog = createDogDefinition();
	const next = stepDogState({
		previous,
		dog,
		toys: [{ x: 500, y: 100, vx: 0, vy: 0 }],
		...baseStepArgs,
	});

	approxEqual(next.x, 110);
	approxEqual(next.y, 100);
	assert.equal(next.target.hasTarget, true);
});

test("stepDogState clamps chase speed to maxChaseSpeed when toy velocity is very high", () => {
	const previous = createPreviousDogState();
	const dog = createDogDefinition();
	const next = stepDogState({
		previous,
		dog,
		toys: [{ x: 500, y: 100, vx: 150000, vy: 0 }],
		...baseStepArgs,
	});

	approxEqual(next.x, 180);
	approxEqual(next.y, 100);
	assert.equal(next.target.hasTarget, true);
});

test("stepDogState clears dynamic target when the dog is within catch distance", () => {
	const previous = createPreviousDogState();
	const dog = createDogDefinition();
	const next = stepDogState({
		previous,
		dog,
		toys: [{ x: 120, y: 100, vx: 0, vy: 0 }],
		...baseStepArgs,
	});

	assert.equal(next.target.hasTarget, false);
	assert.ok(next.x > previous.x);
});

test("stepDogState seeds a wander target when no target exists", () => {
	const previous = createPreviousDogState({ x: 300, y: 300 });
	const dog = createDogDefinition({
		movement: {
			baseSpeed: 0.08,
			minChaseSpeed: 0.1,
			maxChaseSpeed: 0.8,
			targetInsetRatio: 0.5,
			catchDistanceRatio: 0.5,
		},
	});

	const originalRandom = Math.random;
	Math.random = () => 0.1;
	try {
		const next = stepDogState({
			previous,
			dog,
			toys: [],
			dtMs: 16,
			zoom: 1,
			pan: { x: 0, y: 0 },
			viewportRect: { width: 500, height: 400 },
			worldSizePx: 2000,
			spriteHeight: 100,
		});

		assert.equal(next.target.hasTarget, true);
		assert.equal(next.target.y, -28);
	} finally {
		Math.random = originalRandom;
	}
});
