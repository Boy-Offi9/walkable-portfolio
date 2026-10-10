import { el, safe } from './util.js';

const INERT = ['menu', 'dock', 'intro', 'tour'];

export function createList(site, { onClose } = {}) {
  const root = document.getElementById('list');
  let built = false,
    isOpen = false,
    noGL = false,
    back = null,
    prev = null,
    held = [];

  const a = (label, url, cls) => {
    const n = el('a', label, cls);
    n.href = safe(url);
    if (!/^#|^mailto:|^tel:/i.test(n.getAttribute('href'))) {
      n.target = '_blank';
      n.rel = 'noopener';
    }
    return n;
  };
  const tags = list => {
    const ul = el('ul', null, 'ltags');
    (list || []).forEach(t => ul.append(el('li', t)));
    return ul;
  };
  const section = (id, heading) => {
    const s = el('section', null, 'lsec');
    s.id = 'l-' + id;
    s.setAttribute('aria-labelledby', 'l-' + id + '-h');
    const h = el('h2', heading);
    h.id = 'l-' + id + '-h';
    h.tabIndex = -1;
    s.append(h);
    return s;
  };

  function build() {
    built = true;
    const bar = el('div', null, 'lbar');
    back = el('button', 'Back to the room', 'pill');
    back.type = 'button';
    back.onclick = () => api.close();
    bar.append(back);

    const head = el('header', null, 'lhead');
    if (site.photo) {
      const im = el('img', null, 'lava');
      im.alt = site.name;
      im.onerror = () => im.remove();
      im.src = site.photo;
      head.append(im);
    }
    const h1 = el('h1', site.name);
    h1.id = 'lname';
    h1.tabIndex = -1;
    head.append(h1, el('p', site.role, 'lrole'));
    if (site.tagline) head.append(el('p', site.tagline, 'ltag'));

    const nav = el('nav', null, 'lnav');
    nav.setAttribute('aria-label', 'Sections');
    [
      ['About', 'about'],
      ['Projects', 'projects'],
      ['Skills', 'skills'],
      ['Contact', 'contact'],
    ].forEach(([t, id]) => {
      const n = el('a', t);
      n.href = '#l-' + id;
      n.onclick = e => {
        e.preventDefault();
        const h = document.getElementById('l-' + id + '-h');
        h.scrollIntoView({ block: 'start' });
        h.focus({ preventScroll: true });
      };
      nav.append(n);
    });

    const main = el('main', null, 'lmain');
    const about = section('about', 'About');
    about.append(el('p', site.bio));
    main.append(about);

    const prj = section('projects', 'Projects');
    const ol = el('ol', null, 'lprojects');
    site.projects.forEach(p => {
      const li = el('li'),
        art = el('article', null, 'lproj');
      art.append(el('h3', p.title), el('p', [p.role, p.year].filter(Boolean).join(' · '), 'lmeta'));
      const shot = p.image || (p.repo && `https://opengraph.githubassets.com/1/${p.repo}`);
      if (p.video) {
        const v = el('video', null, 'lshot');
        v.controls = true;
        v.muted = true;
        v.playsInline = true;
        v.preload = 'none';
        v.src = p.video;
        v.setAttribute('aria-label', `${p.title} demo video`);
        if (shot) v.poster = shot;
        art.append(v);
      } else if (shot) {
        const im = el('img', null, 'lshot');
        im.alt = `Screenshot of ${p.title}`;
        im.loading = 'lazy';
        im.onerror = () => im.remove();
        im.src = shot;
        art.append(im);
      }
      art.append(el('p', p.description));
      if (p.tags && p.tags.length) art.append(tags(p.tags));
      const links = el('p', null, 'llinks');
      if (p.url) links.append(a('Open project', p.url, 'lbtn'));
      if (p.repo) links.append(a('Source code', `https://github.com/${p.repo}`, 'lbtn ghost'));
      if (links.childNodes.length) art.append(links);
      li.append(art);
      ol.append(li);
    });
    prj.append(ol);
    main.append(prj);

    const sk = section('skills', 'Skills');
    sk.append(tags(site.skills));
    main.append(sk);

    const ct = section('contact', 'Contact');
    const ul = el('ul', null, 'lcontact');
    const row = (label, node) => {
      const li = el('li');
      li.append(el('span', label), node);
      ul.append(li);
    };
    if (site.email) row('Email', a(site.email, 'mailto:' + site.email));
    (site.links || []).forEach(l => row(l.label, a(l.url.replace(/^https?:\/\//, ''), l.url)));
    ct.append(ul);
    main.append(ct);

    const foot = el('footer', `${site.name}. ${site.world ? site.world.name : ''}`.trim(), 'lfoot');
    root.append(bar, head, nav, main, foot);
  }

  const api = {
    get active() {
      return isOpen;
    },
    open(opts = {}) {
      if (isOpen) return;
      noGL = !!opts.noGL;
      document.documentElement.style.setProperty('--a', site.accentColor);
      document.title = `${site.name} | ${site.role}`;
      if (!built) build();
      back.hidden = noGL;
      held = INERT.map(id => document.getElementById(id)).filter(n => n && !n.inert);
      held.forEach(n => (n.inert = true));
      prev = document.activeElement;
      root.hidden = false;
      root.scrollTop = 0;
      isOpen = true;
      document.getElementById('lname').focus({ preventScroll: true });
    },
    close() {
      if (!isOpen || noGL) return;
      isOpen = false;
      root.hidden = true;
      held.forEach(n => (n.inert = false));
      held = [];
      if (prev && prev.focus) prev.focus({ preventScroll: true });
      if (onClose) onClose();
    },
  };
  addEventListener('keydown', e => {
    if (isOpen && e.key === 'Escape') api.close();
  });
  return api;
}
