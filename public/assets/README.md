# Assets

Put your own files here and reference them from `src/config/site.js` without a leading slash. Example: `image: "assets/projects/orbit.jpg"`.

- `profile/`: your portrait (`photo`), tab icon (`favicon`), résumé PDF
- `projects/`: project screenshots, landscape, about 1280x800 (`image`)
- `video/`: short muted `.mp4` loops for the TV reel (`video`)
- `audio/`: `.mp3` files that replace the generated music (`audio.day`, `audio.night`)
- `textures/`: floor, wall and desk texture sets (`npm run textures` fills this)
- `models/`: optional `.glb` models
- `hdri/`: optional equirectangular `.hdr` environment map

Keep files in this folder (same origin). Files from other sites usually cannot be used for audio or video because of browser CORS rules.
