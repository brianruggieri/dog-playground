import test from "node:test";
import assert from "node:assert/strict";
import { computeToyLaunch, stepToyPhysics } from "../src/engine/physics.js";
import { getToy } from "../src/catalog/toys.js";

test("computeToyLaunch returns null when drag is below minimum", () => {
	const toy = getToy("ball");
	const launch = computeToyLaunch({
		startClient: { x: 100, y: 100 },
		endClient: { x: 102, y: 103 },
		viewportRect: { left: 0, top: 0, width: 800, height: 600 },
		pan: { x: 0, y: 0 },
		zoom: 1,
		toy,
	});
	assert.equal(launch, null);
});

test("computeToyLaunch points velocity opposite the drag direction", () => {
	const toy = getToy("ball");
	const launch = computeToyLaunch({
		startClient: { x: 200, y: 200 },
		endClient: { x: 280, y: 260 },
		viewportRect: { left: 0, top: 0, width: 1200, height: 900 },
		pan: { x: 0, y: 0 },
		zoom: 1,
		toy,
	});

	assert.ok(launch);
	assert.ok(launch.vx < 0);
	assert.ok(launch.vy < 0);
	assert.ok(launch.radius > 0);
});

test("stepToyPhysics bounces from the left wall", () => {
	const toy = getToy("ball");
	const initial = {
		x: 5,
		y: 200,
		vx: -350,
		vy: 0,
		radius: 18,
		diameter: 36,
	};

	const { next } = stepToyPhysics(initial, 0.016, 600, toy.physics);
	assert.ok(next.x >= next.radius);
	assert.ok(next.vx > 0);
});

test("stepToyPhysics removes very slow toys", () => {
	const toy = getToy("ball");
	const initial = {
		x: 300,
		y: 300,
		vx: 0.1,
		vy: 0.1,
		radius: 18,
		diameter: 36,
	};

	const { remove } = stepToyPhysics(initial, 0.1, 600, toy.physics);
	assert.equal(remove, true);
});
