export const GRID_SIZE = 24;
export const INCHES_PER_GRID = 6;
export const GRID_FEET = 100;
export const GRID_UNITS = (GRID_FEET * 12) / INCHES_PER_GRID;
export const GRID_PIXEL_SIZE = GRID_UNITS * GRID_SIZE;

export const BASE_TOY_INCHES = 6;
export const BASE_TOY_SCALE = 2.125;
export const DOG_SPRITE_TARGET_HEIGHT = (25 / INCHES_PER_GRID) * GRID_SIZE * 2.2;
