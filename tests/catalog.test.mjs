import test from "node:test";
import assert from "node:assert/strict";
import { getDog, registerDog } from "../src/catalog/dogs.js";
import { getToy, registerToy } from "../src/catalog/toys.js";

test("registerDog adds an extendable dog definition", () => {
	registerDog({
		id: "test-pointer",
		name: "Test Pointer",
		frames: ["/public/dogs/dog-01.webp"],
		movement: {
			baseSpeed: 0.2,
		},
	});

	const testDog = getDog("test-pointer");
	assert.equal(testDog.name, "Test Pointer");
	assert.equal(testDog.movement.baseSpeed, 0.2);
	assert.equal(typeof testDog.movement.maxChaseSpeed, "number");
});

test("getDog falls back to a valid dog when id is unknown", () => {
	const fallbackDog = getDog("missing-id");
	assert.ok(fallbackDog.id);
	assert.ok(Array.isArray(fallbackDog.frames));
	assert.ok(fallbackDog.frames.length > 0);
});

test("registerToy rejects invalid definitions", () => {
	assert.throws(
		() =>
			registerToy({
				id: "invalid-toy",
				name: "Invalid Toy",
			}),
		/assetUrl/,
	);
});

test("registerToy supports adding a new toy profile", () => {
	registerToy({
		id: "rope",
		name: "Rope",
		assetUrl: "/public/toys/bone.webp",
		launch: {
			maxScreenSpeed: 900,
		},
	});

	const rope = getToy("rope");
	assert.equal(rope.name, "Rope");
	assert.equal(rope.launch.maxScreenSpeed, 900);
	assert.equal(typeof rope.physics.damping, "number");
});
