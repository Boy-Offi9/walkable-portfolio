const $ = id => document.getElementById(id);
const el = (tag, txt, cls) => {
  const e = document.createElement(tag);
  if (txt != null) e.textContent = txt;
  if (cls) e.className = cls;
  return e;
};
const safe = u => (u && (/^(https?:|mailto:|tel:)/i.test(u) || !/^\s*(\w+:|\/\/)/.test(u)) ? u : '#');
const link = (label, url, cls = 'btn') => {
  const a = el('a', label, cls);
  a.href = safe(url);
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
};
const btn = (label, fn, cls = 'btn') => {
  const b = el('button', label, cls);
  b.type = 'button';
  b.onclick = fn;
  return b;
};
const chips = list => {
  const c = el('p', null, 'chips');
  (list || []).forEach(k => c.append(el('span', k)));
  return c;
};
const row = (d, fn) => {
  const li = el('li'),
    b = btn('', fn, 'row');
  b.append(el('b', d.title), el('span', d.sub));
  li.append(b);
  return li;
};
const fmt = h => {
  const m = Math.round(h * 60) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};

export const describe = (site, s) =>
  s.type === 'about'
    ? { title: 'About', sub: site.name }
    : s.type === 'projects'
      ? { title: 'Projects', sub: `${site.projects.length} in the notebook` }
      : s.type === 'skills'
        ? { title: 'Skills', sub: `${site.skills.length} on the tablet` }
        : { title: 'Contact', sub: site.email };

const KEY = 'walk-prefs',
  prefs = { details: false, tags: false };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch (e) {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch (e) {}
};

export function initUI(site, st, act) {
  const w = site.world,
    idx = t => st.findIndex(s => s.type === t),
    iAbout = idx('about'),
    iProj = idx('projects'),
    iSkills = idx('skills'),
    iContact = idx('contact');
  document.documentElement.style.setProperty('--a', site.accentColor);
  document.title = `${site.name} | ${w.name}`;
  const markTxt = w.mark || site.name.slice(0, 2).toUpperCase();
  $('mark').textContent = markTxt;
  $('mark2').textContent = markTxt;
  $('name').textContent = site.name;
  $('sub').textContent = w.subtitle || w.name;
  $('q').placeholder = `Search ${w.name}...`;

  const panel = $('panel'),
    menu = $('menu'),
    scrim = $('scrim');
  const setOpen = on => {
    panel.classList.toggle('open', on);
    panel.inert = !on;
    menu.setAttribute('aria-expanded', String(on));
    menu.classList.toggle('on', on);
    scrim.hidden = !(on && innerWidth < 900);
    if (on) $('pclose').focus({ preventScroll: true });
    else if (panel.contains(document.activeElement)) menu.focus({ preventScroll: true });
  };
  const isOpen = () => panel.classList.contains('open');
  menu.onclick = () => setOpen(!isOpen());
  $('pclose').onclick = () => setOpen(false);
  scrim.onclick = () => setOpen(false);
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });
  const leave = () => {
    if (innerWidth < 900) setOpen(false);
  };

  const pills = $('pills'),
    decks = [];
  [
    ['Home', iAbout],
    ['Projects', iProj],
    ['Skills', iSkills],
    ['Contact', iContact],
  ].forEach(([l, i]) =>
    pills.append(
      btn(
        l,
        () => {
          act.go(i);
          leave();
        },
        'pill'
      )
    )
  );
  st.forEach((s, i) => {
    const d = describe(site, s);
    const b = btn(
      '',
      () => {
        act.go(i);
        leave();
      },
      'stn'
    );
    b.append(el('i', String(i + 1).padStart(2, '0')), el('b', d.title), el('span', d.sub));
    decks.push(b);
  });
  const stnList = el('div', null, 'stns');
  stnList.append(...decks);
  pills.after(stnList);

  const tl = $('tl'),
    clock = $('clock'),
    play = $('tplay'),
    pk = on => panel.classList.toggle('peek', on);
  tl.oninput = () => act.scrub(parseFloat(tl.value));
  tl.addEventListener('pointerdown', () => {
    if (innerWidth < 900) pk(true);
  });
  ['pointerup', 'pointercancel', 'blur'].forEach(ev => tl.addEventListener(ev, () => pk(false)));
  play.onclick = () => {
    play.textContent = act.togglePlay() ? 'Pause' : 'Play';
  };
  const mus = $('tmus');
  mus.onclick = () => {
    const on = act.toggleMusic();
    mus.classList.toggle('on', on);
    mus.setAttribute('aria-pressed', String(on));
  };

  const entries = [
    { t: site.name, s: site.role, h: [site.name, site.role, site.bio].join(' '), go: () => act.go(iAbout) },
    ...site.projects.map((p, k) => ({
      t: p.title,
      s: `${p.role} · ${p.year}`,
      h: [p.title, p.role, p.description, ...(p.tags || [])].join(' '),
      go: () => act.go(iProj, k),
    })),
    {
      t: 'Skills',
      s: site.skills.slice(0, 3).join(', '),
      h: site.skills.join(' '),
      go: () => act.go(iSkills),
    },
    {
      t: 'Contact',
      s: site.email,
      h: ['contact email', site.email, ...site.links.map(l => l.label)].join(' '),
      go: () => act.go(iContact),
    },
  ];
  const q = $('q'),
    res = $('results'),
    find = v => entries.filter(e => e.h.toLowerCase().includes(v));
  const pick = e => {
    q.value = '';
    res.hidden = true;
    q.blur();
    leave();
    e.go();
  };
  const run = () => {
    const v = q.value.trim().toLowerCase();
    res.replaceChildren();
    if (!v) {
      res.hidden = true;
      return;
    }
    const hits = find(v).slice(0, 6);
    if (!hits.length) res.append(el('li', 'No match. Try a skill or tag.', 'none'));
    hits.forEach(e => res.append(row({ title: e.t, sub: e.s }, () => pick(e))));
    res.hidden = false;
  };
  q.addEventListener('input', run);
  q.addEventListener('keydown', e => {
    const v = q.value.trim().toLowerCase();
    if (e.key === 'Enter' && v) {
      const h = find(v)[0];
      if (h) pick(h);
    }
    if (e.key === 'Escape' && q.value) {
      q.value = '';
      run();
      e.stopPropagation();
    }
  });

  const tags = [...new Set(site.projects.flatMap(p => p.tags || []))],
    boxes = { details: [], tags: [] };
  const sw = (txt, key) => {
    const l = el('label', null, 'sw lab'),
      i = el('input');
    i.type = 'checkbox';
    l.append(i, el('span', null, 'trk'), el('b', txt));
    boxes[key].push(i);
    return l;
  };
  const sync = () =>
    Object.keys(boxes).forEach(k =>
      boxes[k].forEach(i => {
        i.checked = prefs[k];
        i.onchange = () => {
          prefs[k] = i.checked;
          save();
          sync();
          if (k === 'details') renderCard();
        };
      })
    );
  $('switches').append(sw('Detail cards', 'details'), sw('Name tags', 'tags'));
  const stats = $('stats'),
    grid = $('tiles'),
    topics = $('topics');
  let qLabel, liveB, liveS;
  [
    ['Projects', site.projects.length],
    ['Skills', site.skills.length],
    ['Topics', tags.length],
  ].forEach(([k, v]) => {
    const s = el('span');
    s.append(el('b', String(v)), document.createTextNode(' ' + k));
    stats.append(s);
  });
  tags.forEach(t =>
    topics.append(
      btn(
        t,
        () => {
          q.value = t;
          run();
          q.focus();
        },
        'chip'
      )
    )
  );
  const close = f => () => {
    leave();
    f();
  };
  [
    ['Continue', 'Walk to the next station', act.next],
    ['Window view', 'See what is outside', act.view],
    ['Daytime', 'Jump to 11:00', () => act.goTime(11)],
    ['Cyber night', 'Jump to 22:00', () => act.goTime(22)],
    ['Notebook', 'Open the projects', () => act.go(iProj)],
    ['Smart TV', 'About me', () => act.go(iAbout)],
    ['Workstation', 'Say hello', () => act.go(iContact)],
    ['Topics', 'Browse every tag', null],
    ['Surprise me', 'Land on a random spot', act.surprise],
    ['Live weather', 'Match the real sky', act.live],
    ['Quality: Auto', 'Tap to cycle: Auto, Low, Medium, High', act.quality],
  ].forEach(([t, d, f]) => {
    const b = btn(
        '',
        f
          ? close(f)
          : () => {
              topics.hidden = !topics.hidden;
            },
        'tile'
      ),
      bb = el('b', t);
    b.append(bb, el('span', d));
    if (t.startsWith('Quality')) qLabel = bb;
    if (t === 'Live weather') {
      liveB = bb;
      liveS = b.lastChild;
    }
    grid.append(b);
  });

  const dock = $('dock'),
    card = $('card');
  let cs = null;
  function renderDock() {
    dock.replaceChildren();
    dock.hidden = true;
    if (!cs) return;
    if (cs.type === 'projects') {
      const { page, count } = act.getPage(),
        p = site.projects[page];
      dock.append(
        btn('‹', () => act.page(-1), 'pill'),
        el('span', `${page + 1}/${count}  ${p.title}`, 'dk'),
        btn('›', () => act.page(1), 'pill')
      );
      if (p.url) dock.append(link('Open', p.url, 'pill'));
    } else if (cs.type === 'contact') {
      const inp = el('input', null, 'cmd');
      inp.placeholder = 'try: help';
      inp.autocomplete = 'off';
      inp.autocapitalize = 'off';
      inp.spellcheck = false;
      inp.setAttribute('aria-label', 'Terminal command');
      inp.oninput = () => act.termInput(inp.value);
      inp.onkeydown = e => {
        if (e.key === 'Enter') {
          act.termExec(inp.value);
          inp.value = '';
        }
      };
      dock.append(inp, link(site.email, 'mailto:' + site.email, 'pill'));
      site.links.forEach(l => dock.append(link(l.label, l.url, 'pill')));
    } else if (cs.type === 'about') dock.append(btn('TV: Home / Reel', act.tv, 'pill'));
    else return;
    dock.hidden = false;
  }
  function renderCard() {
    card.replaceChildren();
    card.hidden = !prefs.details || !cs;
    if (card.hidden) return;
    const d = describe(site, cs),
      head = el('div', null, 'head'),
      tg = el('button', 'Hide', 'mini'),
      acts = el('div', null, 'acts');
    tg.type = 'button';
    card.classList.remove('min');
    tg.onclick = () => {
      tg.textContent = card.classList.toggle('min') ? 'Show' : 'Hide';
    };
    if (cs.type === 'projects') {
      const { page, count } = act.getPage(),
        p = site.projects[page],
        meta = el('div', null, 'meta');
      head.append(el('span', `Project ${page + 1} of ${count}`), tg);
      const shot = p.image || (p.repo && `https://opengraph.githubassets.com/1/${p.repo}`);
      if (shot) {
        const im = el('img', null, 'shot');
        im.alt = '';
        im.loading = 'lazy';
        im.onerror = () => im.remove();
        im.src = shot;
        card.append(head, im);
      } else card.append(head);
      card.append(
        el('h2', p.title),
        el('p', `${p.role} · ${p.year}`, 'r'),
        el('p', p.description, 'd'),
        chips(p.tags)
      );
      [
        ['Role', p.role],
        ['Year', p.year],
      ].forEach(([k, v]) => {
        const m = el('div');
        m.append(el('small', k), el('b', v));
        meta.append(m);
      });
      card.append(meta);
      acts.append(
        btn('‹ Prev', () => act.page(-1), 'btn ghost'),
        btn('Next ›', () => act.page(1), 'btn ghost')
      );
      if (p.url) acts.append(link('Open project', p.url));
      card.append(acts);
      if (count > 1) {
        const ul = el('ul', null, 'rel');
        site.projects.forEach((o, k) => {
          if (k !== page)
            ul.append(row({ title: o.title, sub: `${o.role} · ${o.year}` }, () => act.go(iProj, k)));
        });
        card.append(el('p', 'Also in the notebook', 'k'), ul);
      }
    } else {
      head.append(el('span', d.title), tg);
      card.append(head);
      if (cs.type === 'about' && site.photo) {
        const im = el('img', null, 'ava');
        im.alt = '';
        im.onerror = () => im.remove();
        im.src = site.photo;
        card.append(im);
      }
      card.append(
        el('h2', cs.type === 'about' ? site.name : cs.type === 'skills' ? 'What I work with' : 'Say hello')
      );
      if (cs.type === 'about')
        card.append(el('p', site.role, 'r'), el('p', site.bio, 'd'), chips(site.skills));
      else if (cs.type === 'skills') card.append(chips(site.skills));
      else {
        card.append(el('p', 'Pick a channel.', 'd'));
        acts.append(link(site.email, 'mailto:' + site.email));
        site.links.forEach(l => acts.append(link(l.label, l.url, 'btn ghost')));
        card.append(acts);
      }
    }
    card.classList.remove('show');
    void card.offsetWidth;
    card.classList.add('show');
  }
  sync();
  return {
    prefs,
    setStation(i) {
      decks.forEach((b, k) => b.classList.toggle('on', k === i));
    },
    setStatus(t) {
      $('status').textContent = t;
    },
    setClock(h) {
      tl.value = h;
      clock.textContent = fmt(h);
    },
    setMusic(on) {
      mus.classList.toggle('on', on);
      mus.setAttribute('aria-pressed', String(on));
    },
    setQuality(pref, tier) {
      const c = v => v[0].toUpperCase() + v.slice(1);
      if (qLabel) qLabel.textContent = `Quality: ${pref === 'auto' ? 'Auto (' + c(tier) + ')' : c(pref)}`;
    },
    setWeather(w) {
      if (liveS) liveS.textContent = w.text;
    },
    setLive(on) {
      if (liveB) liveB.textContent = on ? 'Live: On' : 'Live weather';
    },
    close: () => setOpen(false),
    show(s) {
      cs = s;
      renderDock();
      renderCard();
    },
    setPage() {
      renderDock();
      renderCard();
    },
  };
}
