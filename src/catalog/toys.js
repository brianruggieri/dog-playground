import { resolveAssetUrl } from "../assets.js";

const toyRegistry = new Map();

const defaultToys = [
	{
		id: "ball",
		name: "Ball",
		assetUrl: resolveAssetUrl("public/toys/ball.png"),
		diameterMultiplier: 1,
		launch: {
			minDragPx: 8,
			minScreenSpeed: 200,
			maxScreenSpeed: 1500,
		},
		physics: {
			damping: 0.8,
			restitution: 0.72,
			wallFriction: 0.96,
			speedThreshold: 6,
		},
	},
	{
		id: "frisbee",
		name: "Frisbee",
		assetUrl: resolveAssetUrl("public/toys/frisbee.png"),
		diameterMultiplier: 2,
		launch: {
			minDragPx: 8,
			minScreenSpeed: 260,
			maxScreenSpeed: 1800,
		},
		physics: {
			damping: 0.65,
			restitution: 0.62,
			wallFriction: 0.94,
			speedThreshold: 8,
		},
	},
	{
		id: "bone",
		name: "Bone",
		assetUrl: resolveAssetUrl("public/toys/bone.png"),
		diameterMultiplier: 1,
		launch: {
			minDragPx: 8,
			minScreenSpeed: 180,
			maxScreenSpeed: 1200,
		},
		physics: {
			damping: 0.95,
			restitution: 0.5,
			wallFriction: 0.92,
			speedThreshold: 5,
		},
	},
];

function assertValidToyDefinition(definition) {
	if (!definition || typeof definition !== "object") {
		throw new Error("Toy definition must be an object.");
	}
	if (!definition.id || typeof definition.id !== "string") {
		throw new Error("Toy definition requires a string id.");
	}
	if (!definition.name || typeof definition.name !== "string") {
		throw new Error("Toy definition requires a string name.");
	}
	if (!definition.assetUrl || typeof definition.assetUrl !== "string") {
		throw new Error("Toy definition requires an assetUrl.");
	}
}

export function registerToy(definition) {
	assertValidToyDefinition(definition);
	toyRegistry.set(definition.id, {
		...definition,
		diameterMultiplier: definition.diameterMultiplier ?? 1,
		launch: {
			minDragPx: 8,
			minScreenSpeed: 200,
			maxScreenSpeed: 1500,
			...(definition.launch || {}),
		},
		physics: {
			damping: 0.8,
			restitution: 0.72,
			wallFriction: 0.96,
			speedThreshold: 6,
			...(definition.physics || {}),
		},
	});
	return toyRegistry.get(definition.id);
}

export function getToyOptions() {
	return Array.from(toyRegistry.values()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

export function getToy(id) {
	const options = getToyOptions();
	if (options.length === 0) {
		throw new Error("Toy catalog is empty.");
	}
	return toyRegistry.get(id) || options[0];
}

for (const toy of defaultToys) {
	registerToy(toy);
}
