import { resolveAssetUrl } from "../assets.js";

const dogRegistry = new Map();

const sharedFrames = [
	resolveAssetUrl("public/dogs/dog-01.png"),
	resolveAssetUrl("public/dogs/dog-02.png"),
	resolveAssetUrl("public/dogs/dog-03.png"),
	resolveAssetUrl("public/dogs/dog-04.png"),
];

const defaultDogs = [
	{
		id: "farm-collie",
		name: "Farm Collie",
		description: "Balanced wander/chase behavior.",
		frames: sharedFrames,
		frameAngles: [60, 90, 0, 270],
		upwardFrameIndex: 3,
		visualScale: 1,
		movement: {
			baseSpeed: 0.08,
			minChaseSpeed: 0.02,
			maxChaseSpeed: 0.6,
			targetInsetRatio: 0.6,
			catchDistanceRatio: 0.55,
		},
	},
	{
		id: "quick-collie",
		name: "Quick Collie",
		description: "Moves faster when chasing throws.",
		frames: sharedFrames,
		frameAngles: [60, 90, 0, 270],
		upwardFrameIndex: 3,
		visualScale: 1,
		movement: {
			baseSpeed: 0.1,
			minChaseSpeed: 0.03,
			maxChaseSpeed: 0.75,
			targetInsetRatio: 0.6,
			catchDistanceRatio: 0.5,
		},
	},
	{
		id: "steady-shepherd",
		name: "Steady Shepherd",
		description: "Calmer wander profile.",
		frames: sharedFrames,
		frameAngles: [60, 90, 0, 270],
		upwardFrameIndex: 3,
		visualScale: 1,
		movement: {
			baseSpeed: 0.07,
			minChaseSpeed: 0.02,
			maxChaseSpeed: 0.45,
			targetInsetRatio: 0.6,
			catchDistanceRatio: 0.6,
		},
	},
];

function assertValidDogDefinition(definition) {
	if (!definition || typeof definition !== "object") {
		throw new Error("Dog definition must be an object.");
	}
	if (!definition.id || typeof definition.id !== "string") {
		throw new Error("Dog definition requires a string id.");
	}
	if (!definition.name || typeof definition.name !== "string") {
		throw new Error("Dog definition requires a string name.");
	}
	if (!Array.isArray(definition.frames) || definition.frames.length === 0) {
		throw new Error("Dog definition requires at least one frame image.");
	}
}

export function registerDog(definition) {
	assertValidDogDefinition(definition);
	dogRegistry.set(definition.id, {
		...definition,
		movement: {
			baseSpeed: 0.08,
			minChaseSpeed: 0.02,
			maxChaseSpeed: 0.6,
			targetInsetRatio: 0.6,
			catchDistanceRatio: 0.55,
			...(definition.movement || {}),
		},
	});
	return dogRegistry.get(definition.id);
}

export function getDogOptions() {
	return Array.from(dogRegistry.values()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

export function getDog(id) {
	const options = getDogOptions();
	if (options.length === 0) {
		throw new Error("Dog catalog is empty.");
	}
	return dogRegistry.get(id) || options[0];
}

for (const dog of defaultDogs) {
	registerDog(dog);
}
