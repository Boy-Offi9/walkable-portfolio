// Edit this file to make the portfolio yours.
export const site = {
  name: 'Ada Rivera',
  role: 'Creative Developer',
  tagline: 'I build interfaces you can walk through.',
  bio: 'Mock data: replace this with a few sentences about you. Ada designs and ships interactive web experiences, from tiny tools to full 3D worlds.',
  accentColor: '34 211 238', // "R G B", no commas
  email: 'ada@example.com',
  links: [
    { label: 'GitHub', url: 'https://github.com/your-handle' },
    { label: 'Writing', url: 'https://example.com/blog' },
  ],
  skills: ['JavaScript', 'three.js', 'WebGL', 'Node.js', 'Design systems', 'Accessibility'],
  // Notebook brainstorm lines
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
      image: '', // file under public/ or a full URL
      repo: '', // or "owner/name" for a GitHub preview
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
  // Live weather and local time. Set to null to turn off.
  weather: { lat: 51.5074, lon: -0.1278, label: 'London' },

  // Optional HD assets. Leave "" to keep the built-in look. Files go in public/assets/, paths have no leading slash.
  assets: {
    hdri: '',
    floor: { color: '', normal: '', rough: '', repeat: [4, 5] },
    walls: { color: '', normal: '', rough: '', repeat: [1, 1] }, // 1 tile = 2 m
    desk: { color: '', normal: '', rough: '', repeat: [1, 1] }, // 1 tile = 0.9 m
    // Heavier files for the High tier. Any slot left empty falls back to the files above.
    high: {
      hdri: '',
      floor: { color: '', normal: '', rough: '', repeat: [4, 5] },
      walls: { color: '', normal: '', rough: '', repeat: [1, 1] },
      desk: { color: '', normal: '', rough: '', repeat: [1, 1] },
      models: [],
    },
    // Add tier: "high" to a model to load it on the High tier only.
    models: [
      // { url: "assets/models/chair.glb", position: [-1.07, 0, -3.45], rotationY: 0.35, scale: 1,
      //   replace: "chair",
      //   blocker: [-1.5, -0.6, -3.9, -3.0]
      // },
    ],
  },
  world: {
    name: 'Orbital Archive',
    mark: 'OA', // two letters
    subtitle: 'Portfolio world',
    startHour: 10.5, // 0-24
    dayLengthSeconds: 120, // seconds per day
  },
};
