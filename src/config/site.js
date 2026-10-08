// The ONLY file you need to edit. Field names match Boy-Offi9/portfolio-template,
// so you can copy name, bio, links, skills and projects straight across.
export const site = {
  name: 'Ada Rivera',
  role: 'Creative Developer',
  tagline: 'I build interfaces you can walk through.',
  bio: 'Mock data: replace this with a few sentences about you. Ada designs and ships interactive web experiences, from tiny tools to full 3D worlds.',
  accentColor: '34 211 238', // "R G B", no commas. Reskins the whole world and the UI.
  email: 'ada@example.com',
  links: [
    { label: 'GitHub', url: 'https://github.com/your-handle' },
    { label: 'Writing', url: 'https://example.com/blog' },
  ],
  skills: ['JavaScript', 'three.js', 'WebGL', 'Node.js', 'Design systems', 'Accessibility'],
  // Brainstorm notes: shown as starred lines on the notebook's left page. Make them yours.
  ideas: [
    'Voice-guided tour of the room',
    'Live GitHub activity on the wall',
    'Generative music that follows the time of day',
    'WebXR walk-through for headsets',
  ],
  projects: [
    {
      title: 'Orbit Notes',
      role: 'Solo developer',
      year: '2026',
      description: 'Mock project: a local-first notes app that links ideas into a browsable star map.',
      tags: ['Vite', 'IndexedDB', 'Canvas'],
      url: 'https://example.com/orbit-notes',
      image: '', // local path (assets/projects/x.png) or full image URL
      repo: '', // or "owner/name" to try that repo's GitHub preview card
    },
    {
      title: 'Signal Garden',
      role: 'Frontend lead',
      year: '2025',
      description:
        'Mock project: a live dashboard that turns sensor streams into a growing generative garden.',
      tags: ['WebSockets', 'three.js', 'Node.js'],
      url: 'https://example.com/signal-garden',
      image: '',
      repo: '',
    },
    {
      title: 'Tidal CLI',
      role: 'Author',
      year: '2025',
      description:
        'Mock project: a small command-line tool that schedules and replays tide-based automations.',
      tags: ['Node.js', 'CLI', 'Testing'],
      url: 'https://example.com/tidal-cli',
      image: '',
      repo: '',
    },
    {
      title: 'Lumen UI',
      role: 'Design engineer',
      year: '2024',
      description: 'Mock project: an accessible component kit with a glow-first design language.',
      tags: ['Components', 'A11y', 'CSS'],
      url: 'https://example.com/lumen-ui',
      image: '',
      repo: '',
    },
  ],
  // Live weather and local time for this city (Open-Meteo, no key). Set to null to turn it off.
  weather: { lat: 51.5074, lon: -0.1278, label: 'London' },

  // OPTIONAL HD assets. Leave a value "" (or delete a section) to keep the built-in procedural look.
  // Put files in public/assets/ and use paths WITHOUT a leading slash, e.g. "assets/textures/floor_color.jpg".
  // Textures can be .jpg .png .webp or .ktx2 (smallest on the GPU). Aim for 1024px.
  assets: {
    hdri: '', // optional equirectangular .hdr for reflections, e.g. "assets/hdri/room_1k.hdr" (Poly Haven HDRIs are CC0)
    floor: { color: '', normal: '', rough: '', repeat: [4, 5] },
    walls: { color: '', normal: '', rough: '', repeat: [1, 1] }, // all plaster surfaces. 1 tile = 2 m on every wall and the ceiling
    desk: { color: '', normal: '', rough: '', repeat: [1, 1] }, // all wood furniture. 1 tile = 0.9 m
    models: [
      // { url: "assets/models/chair.glb", position: [-1.07, 0, -3.45], rotationY: 0.35, scale: 1,
      //   replace: "chair",                 // hides the built-in chair
      //   blocker: [-1.5, -0.6, -3.9, -3.0] // optional [x0, x1, z0, z1] area visitors cannot walk through
      // },
    ],
  },
  world: {
    name: 'Orbital Archive', // shown in the top bar and station counter
    mark: 'OA', // two letters for the logo tile
    subtitle: 'Portfolio world',
    startHour: 10.5, // 0-24, the hour you arrive at (10.5 = 10:30)
    dayLengthSeconds: 120, // real seconds for a full day when you press Play
  },
};
