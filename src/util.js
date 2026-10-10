export const el = (tag, txt, cls) => {
  const e = document.createElement(tag);
  if (txt != null) e.textContent = txt;
  if (cls) e.className = cls;
  return e;
};

export const safe = u => (u && (/^(https?:|mailto:|tel:)/i.test(u) || !/^\s*(\w+:|\/\/)/.test(u)) ? u : '#');
