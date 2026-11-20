/* =========================================================
   shared.js — utilitas bersama untuk situs & panel admin
   ========================================================= */
(function () {
  'use strict';

  const BASE = '/';
  const DATA_PATH = 'data/portfolio.json';
  const DRAFT_KEY = 'pf:draft:v1';
  const GH_KEY = 'pf:github:v1';
  const DEVICON = 'https://cdn.jsdelivr.net/npm/devicon@2.16.0/icons/';

  /* ---------- Safe storage ---------- */
  const store = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  };

  /* ---------- IndexedDB (file yang belum dipublikasikan) ---------- */
  const memFiles = new Map();
  let dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open('pf-store', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
    return dbPromise;
  }
  function idbReq(mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    }));
  }
  const files = {
    async set(path, value) {
      memFiles.set(path, value);
      try { await idbReq('readwrite', s => s.put(value, path)); } catch (e) { /* memori saja */ }
    },
    async del(path) {
      memFiles.delete(path);
      try { await idbReq('readwrite', s => s.delete(path)); } catch (e) { /* ignore */ }
    },
    async clear() {
      memFiles.clear();
      try { await idbReq('readwrite', s => s.clear()); } catch (e) { /* ignore */ }
    },
    async all() {
      try {
        const db = await openDb();
        const entries = await new Promise((resolve, reject) => {
          const tx = db.transaction('files', 'readonly');
          const s = tx.objectStore('files');
          const kr = s.getAllKeys();
          const vr = s.getAll();
          tx.oncomplete = () => resolve(kr.result.map((k, i) => [k, vr.result[i]]));
          tx.onerror = () => reject(tx.error);
        });
        entries.forEach(([k, v]) => memFiles.set(k, v));
      } catch (e) { /* pakai memori */ }
      return memFiles;
    },
    map: memFiles
  };

  /* ---------- Path aset ---------- */
  function asset(path) {
    if (!path) return '';
    if (memFiles.has(path)) return memFiles.get(path).dataUrl;
    if (/^(https?:|data:|blob:|\/)/i.test(path)) return path;
    return BASE + path.replace(/^\.?\//, '');
  }

  /* ---------- Data ---------- */
  async function fetchPublished() {
    const res = await fetch(BASE + DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memuat data (' + res.status + ')');
    return res.json();
  }
  async function loadData({ preview = false } = {}) {
    if (preview) {
      const draft = store.get(DRAFT_KEY);
      if (draft && draft.data) {
        await files.all();
        return draft.data;
      }
    }
    return fetchPublished();
  }

  /* ---------- Helpers ---------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const slug = (s) => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

  function hue(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function fmtMonth(v, long = false) {
    if (!v) return '';
    const m = String(v).match(/^(\d{4})(?:-(\d{1,2}))?/);
    if (!m) return String(v);
    if (!m[2]) return m[1];
    const idx = parseInt(m[2], 10) - 1;
    return (long ? MONTHS_LONG : MONTHS)[idx] + ' ' + m[1];
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear();
  }
  function relTime(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'baru saja';
    const units = [[31536000, 'tahun'], [2592000, 'bulan'], [604800, 'minggu'], [86400, 'hari'], [3600, 'jam'], [60, 'menit']];
    for (const [sec, name] of units) {
      const n = Math.floor(diff / sec);
      if (n >= 1) return n + ' ' + name + ' lalu';
    }
    return 'baru saja';
  }

  /* ---------- Devicon ---------- */
  const ICON_ALIAS = {
    'html': 'html5', 'html5': 'html5', 'css': 'css3', 'css3': 'css3', 'js': 'javascript', 'javascript': 'javascript',
    'ts': 'typescript', 'typescript': 'typescript', 'react': 'react', 'reactjs': 'react', 'react.js': 'react',
    'next': 'nextjs', 'next.js': 'nextjs', 'nextjs': 'nextjs', 'vue': 'vuejs', 'vue.js': 'vuejs', 'vuejs': 'vuejs',
    'tailwind': 'tailwindcss', 'tailwind css': 'tailwindcss', 'tailwindcss': 'tailwindcss', 'bootstrap': 'bootstrap',
    'vite': 'vitejs', 'node': 'nodejs', 'node.js': 'nodejs', 'nodejs': 'nodejs', 'express': 'express', 'express.js': 'express',
    'php': 'php', 'laravel': 'laravel', 'codeigniter': 'codeigniter', 'mysql': 'mysql', 'postgresql': 'postgresql', 'postgres': 'postgresql',
    'mongodb': 'mongodb', 'firebase': 'firebase', 'python': 'python', 'tensorflow': 'tensorflow', 'jupyter': 'jupyter',
    'streamlit': 'streamlit', 'java': 'java', 'kotlin': 'kotlin', 'android': 'android', 'android studio': 'androidstudio',
    'flutter': 'flutter', 'dart': 'dart', 'git': 'git', 'github': 'github', 'vs code': 'vscode', 'vscode': 'vscode',
    'vercel': 'vercel', 'figma': 'figma', 'docker': 'docker', 'c++': 'cplusplus', 'c#': 'csharp', 'c': 'c', 'go': 'go',
    'golang': 'go', 'linux': 'linux', 'ubuntu': 'ubuntu', 'npm': 'npm', 'sass': 'sass', 'jquery': 'jquery',
    'redux': 'redux', 'pandas': 'pandas', 'numpy': 'numpy', 'opencv': 'opencv', 'pytorch': 'pytorch', 'flask': 'flask',
    'django': 'django', 'wordpress': 'wordpress', 'canva': 'canva', 'photoshop': 'photoshop', 'postman': 'postman',
    'sqlite': 'sqlite', 'supabase': 'supabase', 'nestjs': 'nestjs', 'svelte': 'svelte', 'angular': 'angular'
  };
  const DARK_ICONS = new Set(['nextjs', 'express', 'vercel', 'github', 'flask', 'django', 'threejs', 'apple', 'markdown', 'socketio', 'rust', 'nestjs']);

  function knownIcon(name) {
    return Object.prototype.hasOwnProperty.call(ICON_ALIAS, String(name || '').trim().toLowerCase());
  }
  function deviconSlug(nameOrSlug) {
    const k = String(nameOrSlug || '').trim().toLowerCase();
    if (!k) return '';
    return ICON_ALIAS[k] || k.replace(/[^a-z0-9]/g, '');
  }
  function techIcon(name, explicit) {
    const src = explicit || name;
    if (/^(https?:|data:|\/|assets\/)/i.test(src || '')) {
      return `<img class="ti" src="${esc(asset(src))}" alt="" loading="lazy" onerror="PF.iconFail(this)" data-label="${esc(name)}">`;
    }
    const s = deviconSlug(src);
    if (!s) return `<span class="ti ti-mono">${esc((name || '?').charAt(0))}</span>`;
    const dark = DARK_ICONS.has(s) ? ' ti-invert' : '';
    return `<img class="ti${dark}" src="${DEVICON}${s}/${s}-original.svg" data-slug="${s}" data-label="${esc(name)}" alt="" loading="lazy" onerror="PF.iconFail(this)">`;
  }
  function iconFail(img) {
    const s = img.dataset.slug;
    if (s && !img.dataset.tried) {
      img.dataset.tried = '1';
      img.src = `${DEVICON}${s}/${s}-plain.svg`;
      return;
    }
    const span = document.createElement('span');
    span.className = 'ti ti-mono';
    span.textContent = (img.dataset.label || '?').trim().charAt(0).toUpperCase();
    img.replaceWith(span);
  }

  /* ---------- Ikon SVG (gaya Lucide) ---------- */
  const P = {
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    'external': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'github': '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
    'linkedin': '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
    'instagram': '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
    'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'whatsapp': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    'menu': '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    'graduation': '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    'briefcase': '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'award': '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    'code': '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'calendar': '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
    'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'send': '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'folder': '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
    'sliders': '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'trash': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    'pencil': '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'save': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    'cpu': '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
    'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    'server': '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    'layout': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    'palette': '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'book': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'command': '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
    'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'youtube': '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    'twitter': '<path d="M4 4l11.733 16h4.267l-11.733-16z"/><path d="M4 20l6.768-6.768m2.46-2.46L20 4"/>',
    'facebook': '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    'dribbble': '<circle cx="12" cy="12" r="10"/><path d="M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94"/><path d="M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32"/><path d="M8.56 2.75c4.37 6 6 9.42 8 17.72"/>',
    'tiktok': '<path d="M16 3a5 5 0 0 0 5 5"/><path d="M16 3v11.5a4.5 4.5 0 1 1-4.5-4.5"/>',
    'alert': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'refresh': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    'git-branch': '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'key': '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'chart': '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    'grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
    'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    'pen-tool': '<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>',
    'monitor': '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    'grip': '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    'menu-dots': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'
  };
  function icon(name, cls = '') {
    const p = P[name] || P['sparkles'];
    return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

  const SOCIALS = {
    github: { label: 'GitHub', icon: 'github' },
    linkedin: { label: 'LinkedIn', icon: 'linkedin' },
    instagram: { label: 'Instagram', icon: 'instagram' },
    email: { label: 'Email', icon: 'mail' },
    whatsapp: { label: 'WhatsApp', icon: 'whatsapp' },
    youtube: { label: 'YouTube', icon: 'youtube' },
    twitter: { label: 'X / Twitter', icon: 'twitter' },
    facebook: { label: 'Facebook', icon: 'facebook' },
    tiktok: { label: 'TikTok', icon: 'tiktok' },
    dribbble: { label: 'Dribbble', icon: 'dribbble' },
    website: { label: 'Website', icon: 'globe' },
    other: { label: 'Tautan', icon: 'link' }
  };
  function socialHref(s) {
    const url = String(s.url || '').trim();
    if (!url) return '';
    if (s.platform === 'email' && !/^mailto:/i.test(url)) return 'mailto:' + url;
    if (s.platform === 'whatsapp' && !/^https?:/i.test(url)) return 'https://wa.me/' + url.replace(/[^\d]/g, '').replace(/^0/, '62');
    if (!/^(https?:|mailto:|tel:)/i.test(url)) return 'https://' + url;
    return url;
  }
  function waLink(num, text = '') {
    const n = String(num || '').replace(/[^\d]/g, '').replace(/^0/, '62');
    return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
  }

  function levelLabel(n) {
    n = Number(n) || 0;
    if (n >= 80) return 'Mahir';
    if (n >= 55) return 'Menengah';
    return 'Dasar';
  }

  window.PF = {
    BASE, DATA_PATH, DRAFT_KEY, GH_KEY, store, files, asset, loadData, fetchPublished,
    esc, slug, hue, fmtMonth, fmtDate, relTime, techIcon, iconFail, deviconSlug, knownIcon, icon, P,
    SOCIALS, socialHref, waLink, levelLabel, MONTHS_LONG
  };
})();
