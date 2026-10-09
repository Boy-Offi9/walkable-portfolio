# Walkable Portfolio

A first-person 3D portfolio you walk through instead of scroll. You land in a modern apartment and dev room. Every object holds part of you: the TV is About, the notebook on the dining table is Projects, the tablet is Skills, the workstation terminal is Contact. A window shows a quiet neighbourhood by day. At night the view turns into a cyberpunk city and the room switches to a neon night mode.

Built with **Vite and three.js only**. No backend, no UI framework, no model files required. All content comes from one config file, so you can make it yours in minutes.

## Features

- **One config file.** Name, role, bio, links, skills, projects, brainstorm notes, weather city and accent colour all live in `src/config/site.js`. Field names match [portfolio-template](https://github.com/Boy-Offi9/portfolio-template).
- **Day and night cycle.** A timeline scrubs the hour. By day the desk is a normal one-monitor setup. At night it grows into a multi-monitor rig with animated screens, a hologram projector and a drone, and the room fills with RGB lighting.
- **Outside the window.** A house, trees, a street with moving cars and wind turbines by day. A neon city with a monorail, billboards and a landmark tower with blinking lights at night.
- **Live weather.** Open-Meteo (no API key) drives clouds, rain on the glass and the temperature on the TV. Optionally sync the room to your city's local time.
- **Generated music.** Lo-fi by day and synthwave at night, synthesised with WebAudio. No audio files. The RGB lights pulse to the beat.
- **Procedural PBR textures.** Wood, plaster, concrete, marble, fabric, leather, brushed metal and more are generated in code at start-up. Photo textures, an HDRI and GLB models are optional.
- **Interactive details.** A pen writes each project into the notebook, a printer prints, the TV switches between a home screen and a project reel, and the terminal runs commands.
- **Built for phones.** Touch joystick, tap to interact, quality presets and an adaptive guard that steps down when frames run slow.

## Quick start

```bash
git clone git@github.com:Boy-Offi9/walkable-portfolio.git
cd walkable-portfolio
npm install
npm run dev
```

`npm run dev` also serves on your local network, so you can open it on your phone over the same Wi-Fi. Production build:

```bash
npm run build     # static files in dist/
npm run preview   # serve dist/ locally
```

Requires Node 18 or newer and a browser with WebGL 2.

## Make it yours

Edit `src/config/site.js`. It is the only file you need to touch.

| Field                            | What it does                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `name`, `role`, `tagline`, `bio` | Shown on the TV, in the menu and in the page title                                                |
| `accentColor`                    | `"R G B"` with no commas. Reskins the UI and the world's neon                                     |
| `email`, `links`                 | Contact details shown in the terminal and the dock                                                |
| `skills`                         | Tiles on the tablet and the TV, and sketch labels on the whiteboard                               |
| `ideas`                          | Starred brainstorm lines on the notebook's left page                                              |
| `projects`                       | Any number (1 to about 10). Each one is a notebook page, a polaroid, a poster and a TV reel slide |
| `weather`                        | `{ lat, lon, label }` for live weather, or `null` to turn it off                                  |
| `world`                          | `name` and `mark` (two letters) for the logo, `startHour`, `dayLengthSeconds`                     |
| `assets`                         | Optional HD textures, HDRI and GLB models (see below)                                             |

Each project takes `title`, `role`, `year`, `description`, `tags`, `url`, and optionally `image` (a file under `public/assets/` or a full URL) or `repo` (`"owner/name"`) for a taped photo on the notebook page. Without either, a wireframe doodle is drawn.

## Controls

|          | Touch                            | Desktop                 |
| -------- | -------------------------------- | ----------------------- |
| Walk     | Hold the left half of the screen | `W A S D` or arrow keys |
| Look     | Drag the right half              | Drag with the mouse     |
| Interact | Tap the notebook, TV or remote   | Click them              |
| Menu     | Top-left button                  | Top-left button         |

Walking to a station zooms in slightly so small text is readable. Moving cancels the zoom.

The **Menu** opens a side panel with search, station shortcuts, the timeline, switches for detail cards and name tags, quick jumps (window view, daytime, cyber night, surprise me, live weather) and a **Quality** switch. Your choices are remembered.

### Terminal commands

At the workstation, type into the dock field:

```
help   whoami   ls   open <n>   theme cyber|rgb|matrix|vapor|amber   weather   clear
```

There is one more hidden theme to find.

## Quality and performance

The quality switch cycles **Auto, Low, Medium, High**.

| Tier   | What changes                                                    |
| ------ | --------------------------------------------------------------- |
| Low    | No shadows, half-resolution textures, no HD assets              |
| Medium | Throttled shadow updates                                        |
| High   | Adds neon bloom                                                 |
| Auto   | Picks a tier from your device and steps down if frames run slow |

Static furniture is merged per material at start-up, so the room costs a few dozen draw calls. Pass `noMerge: true` in the `buildWorld` options if you need to debug individual meshes.

## Optional HD assets

Everything works with no files. To upgrade the look, fill in `assets` in `src/config/site.js` and put files in `public/assets/`. Paths have no leading slash, for example `assets/textures/floor_color.jpg`.

- **Textures** for `floor`, `walls` and `desk`, each with `color`, `normal` and `rough` maps. Wall and wood textures are sized in real metres, so `repeat: [1, 1]` means one tile per 2 m on walls and 0.9 m on wood. Raise it to shrink the pattern.
- **HDRI** (`assets.hdri`): an equirectangular `.hdr` for real reflections.
- **Models**: GLB files with `position`, `rotationY` and `scale`. `replace: "chair"` hides the built-in office chair, and `blocker: [x0, x1, z0, z1]` adds an area visitors cannot walk through.
- **Fetch textures for you**: `npm run textures` downloads CC0 sets from Poly Haven into `public/assets/textures` and prints the snippet to paste into `site.js`. Poly Haven's API is free for non-commercial use only. For a commercial site, download the sets by hand from polyhaven.com and check the ids at the top of `scripts/fetch-textures.mjs`.
- **Budget for mobile**: 1024 px textures (KTX2 if you can) and a whole scene under about 5 to 8 MB. For models:
  `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024`

`npm install` copies the KTX2 and Draco decoders into `public/` automatically. Files that fail to load are skipped, so a missing file never breaks the page.

## Deploy

The build is static, so any static host works. `vite.config.js` uses `base: './'`, which keeps asset paths relative.

- **Vercel or Netlify:** import the repo. Build command `npm run build`, output directory `dist`.
- **GitHub Pages:** publish the `dist` folder.

Fonts (Exo 2 and Caveat) load from Google Fonts. Weather needs network access to Open-Meteo. Everything else works offline.

## Tuning the look

- **Light levels** live in the `TUNE` object at the top of `src/world.js`. `rgb` controls the night glow and `ceiling` the room light.
- **Night themes** are defined by `THEMES` in the same file. The accent colour in `site.js` drives the UI and neon.
- **Code style** is enforced with Prettier. Run `npm run format` before committing.

## Project structure

```
index.html            page shell: canvas, menu, side panel, dock
src/
  main.js             renderer, game loop, quality presets, camera, stations
  world.js            the whole 3D scene: room, props, outside, day/night, update loop
  materials.js        procedural PBR texture generators
  screens.js          animated canvas screens for the monitors
  ui.js               side panel, timeline, search, dock, detail cards
  controls.js         touch joystick, mouse and keyboard input
  labels.js           optional floating name tags
  music.js            WebAudio generative music
  weather.js          Open-Meteo client
  assets.js           optional HD textures, HDRI and GLB loading
  style.css           interface styles
  config/site.js      all your content
scripts/
  copy-decoders.mjs   copies KTX2 and Draco decoders into public/ on install
  fetch-textures.mjs  downloads CC0 texture sets from Poly Haven
public/assets/        your images, textures, models and HDRI
```

`src/world.js` is one large file with a one-line header per section: lights, sky dome, RGB system, room shell, stations, living area, dining table and notebook, workstation, room fill, wall decor, outside (day and night), time of day, weather and the update loop. Search for the header to jump to a section.

## License

[MIT](LICENSE)
