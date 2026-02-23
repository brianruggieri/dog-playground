# Dog Playground

A standalone extraction of the GardenCraft dog wander + throw-toy interaction.

## Scope

This project intentionally keeps only:

- Large pan/zoom canvas using the original world dimensions.
- Background texture selector and textured grid rendering.
- Dog wandering/chasing behavior.
- Drag-to-throw toy physics (ball, frisbee, bone).
- Small control panel.

Everything unrelated to this interaction (garden beds, plants, AI providers, layout generation) is removed.

## Architecture

The code is organized so dogs and toys are easy to extend:

- `src/catalog/dogs.js`: dog registry with `registerDog`.
- `src/catalog/toys.js`: toy registry with `registerToy`.
- `src/engine/physics.js`: pure toy launch and toy motion physics.
- `src/engine/dogBehavior.js`: dog target selection and frame/orientation logic.
- `src/main.js`: UI wiring, render loop, and controls.

## Run

```bash
source ~/.nvm/nvm.sh && nvm use
npm test
npm run dev
# fallback when portless is unavailable
npm run dev:plain
```

## Controls

- Drag (left mouse / one-finger touch): throw toy.
- Space or middle-mouse drag: pan canvas.
- Wheel: scroll-pan.
- Ctrl/Cmd + wheel: zoom.
- Escape: cancel active throw drag.

## Extending Dogs

Add or register new entries with frame assets and movement settings in `src/catalog/dogs.js`.

## Extending Toys

Add or register new entries with image + launch/physics profiles in `src/catalog/toys.js`.

## Future Expansion Notes

- AI-driven dog generation can write new dog definitions + generated sprite references.
- New toy types can be added without changing core physics loop.
- Interactions like petting/commands can attach to the dog behavior module without changing rendering or toy physics.

## Deployment (GitHub Pages)

- `Deploy GitHub Pages` workflow publishes `dist/` on pushes to `main`.
- In repo settings, set **Pages -> Source** to **GitHub Actions**.

## Versioning

- This repo uses Semantic Versioning with tags (`vX.Y.Z`).
- Use the `Release Version` workflow to bump `patch`, `minor`, or `major`.
- Full guide: `VERSIONING.md`.
