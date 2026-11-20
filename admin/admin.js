/* =========================================================
   admin.js — CMS ringan berbasis GitHub untuk portfolio
   Alur: edit → draft otomatis (browser) → Pratinjau → Publikasikan
   (commit ke GitHub) → Vercel membangun ulang situs otomatis.
   ========================================================= */
(function () {
  'use strict';

  const { esc, icon, asset, techIcon, slug, store, files, levelLabel, SOCIALS, fmtDate, fmtMonth, relTime, hue } = PF;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Repositori default — ubah di halaman "Koneksi GitHub" bila berbeda
  const DEFAULT_GH = { owner: 'sfnayy', repo: 'sofyan-portfolio', branch: 'main', token: '' };
  const COVER_HUES = [252, 265, 280, 222, 196, 172, 318, 238];

  const recent = new Map(); // file yang baru dipublikasikan → dataUrl (pratinjau sementara)
  const state = {
    data: null,
    published: '',
    remoteText: null,
    section: 'dashboard',
    gh: Object.assign({}, DEFAULT_GH, store.get(PF.GH_KEY, {}) || {}),
    ghOk: null
  };

  /* =========================================================
     Utilitas
     ========================================================= */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function setPath(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const tgt = keys.reduce((o, k) => (o[k] == null || typeof o[k] !== 'object' ? (o[k] = {}) : o[k]), obj);
    tgt[last] = val;
  }
  const src = (path) => (recent.has(path) ? recent.get(path) : asset(path));
  const isPdfPath = (p) => /\.pdf($|\?)/i.test(p || '') || ((files.map.get(p) || {}).type === 'application/pdf');
  const thisMonth = () => new Date().toISOString().slice(0, 7);
  const coverHue = (s) => COVER_HUES[hue(s) % COVER_HUES.length];
  let uid = 0;
  const nextId = () => 'f' + (++uid);

  function toast(msg, type = 'ok') {
    const ic = type === 'err' ? 'alert' : type === 'warn' ? 'info' : 'check';
    const el = h('div', { class: 'toast ' + type, html: icon(ic) + '<span>' + esc(msg) + '</span>' });
    $('#toasts').append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 5000 : 2800);
  }

  function readAsDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Gagal membaca file'));
      r.readAsDataURL(blob);
    });
  }
  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function download(name, text, type = 'application/json') {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* =========================================================
     Skema data
     ========================================================= */
  function ensureShape(d) {
    d = d && typeof d === 'object' ? d : {};
    ['meta', 'settings', 'profile', 'about'].forEach((k) => { if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {}; });
    ['softSkills', 'services', 'stats', 'skills', 'projects', 'certificates', 'experience', 'education', 'socials'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    return d;
  }
  const uniq = (key, field, extra = []) => [...new Set([...(state.data[key] || []).map((x) => x[field]).filter(Boolean), ...extra])];

  const SECTIONS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', group: 'Umum' },
    { id: 'profile', label: 'Profil', icon: 'user', group: 'Konten' },
    { id: 'about', label: 'Tentang Saya', icon: 'book', group: 'Konten' },
    { id: 'skills', label: 'Skill', icon: 'layers', group: 'Konten', list: true },
    { id: 'projects', label: 'Proyek', icon: 'folder', group: 'Konten', list: true },
    { id: 'certificates', label: 'Sertifikat', icon: 'award', group: 'Konten', list: true },
    { id: 'experience', label: 'Pengalaman', icon: 'briefcase', group: 'Konten', list: true },
    { id: 'education', label: 'Pendidikan', icon: 'graduation', group: 'Konten', list: true },
    { id: 'socials', label: 'Media Sosial', icon: 'link', group: 'Konten', list: true },
    { id: 'settings', label: 'Tampilan & Situs', icon: 'palette', group: 'Pengaturan' },
    { id: 'github', label: 'Koneksi GitHub', icon: 'github', group: 'Pengaturan' },
    { id: 'backup', label: 'Backup & Reset', icon: 'save', group: 'Pengaturan' }
  ];

  const SERVICE_ICONS = ['layout', 'monitor', 'server', 'database', 'cpu', 'smartphone', 'code', 'pen-tool', 'palette', 'rocket', 'shield', 'zap', 'target', 'users', 'chart', 'globe', 'layers', 'sparkles', 'book', 'award', 'briefcase', 'heart'];

  const PROFILE_FIELDS = [
    { type: 'group', label: 'Identitas' },
    { key: 'name', label: 'Nama lengkap', type: 'text', required: true, half: true },
    { key: 'nickname', label: 'Nama panggilan', type: 'text', half: true },
    { key: 'greeting', label: 'Sapaan di bagian atas', type: 'text', placeholder: 'Halo, saya', half: true },
    { key: 'avatar', label: 'Foto profil', type: 'image', folder: 'profile', square: true, maxW: 900, help: 'Gunakan foto persegi (1:1) dengan wajah di tengah agar hasilnya rapi.' },
    { key: 'roles', label: 'Peran / profesi (efek mengetik)', type: 'lines', rows: 4, help: 'Satu peran per baris. Akan tampil bergantian dengan animasi mengetik.' },
    { key: 'tagline', label: 'Tagline singkat', type: 'textarea', rows: 3 },
    { key: 'cv', label: 'File CV (PDF)', type: 'file', accept: 'application/pdf', folder: 'cv', help: 'Jika diisi, tombol "Unduh CV" muncul otomatis.' },
    { type: 'group', label: 'Akademik' },
    { key: 'university', label: 'Universitas', type: 'text', half: true },
    { key: 'major', label: 'Program studi', type: 'text', half: true },
    { key: 'semester', label: 'Semester saat ini', type: 'text', placeholder: 'cth. 5', half: true },
    { type: 'group', label: 'Status & kontak' },
    { key: 'available', label: 'Status ketersediaan', type: 'toggle', text: 'Tampilkan sebagai "terbuka untuk kesempatan" (titik hijau)', half: true },
    { key: 'status', label: 'Teks status', type: 'text', placeholder: 'Terbuka untuk magang & kolaborasi', half: true },
    { key: 'location', label: 'Lokasi', type: 'text', half: true },
    { key: 'email', label: 'Email', type: 'email', half: true, help: 'Tampil publik di bagian kontak (ada tombol salin).' },
    { key: 'whatsapp', label: 'Nomor WhatsApp', type: 'text', placeholder: '08xxxxxxxxxx', half: true, help: 'Opsional. Pengunjung bisa langsung chat.' }
  ];

  const ABOUT_FIELDS = [
    { key: 'about.paragraphs', label: 'Cerita tentang kamu', type: 'paras', rows: 9, help: 'Pisahkan paragraf dengan satu baris kosong. Paragraf pertama tampil lebih menonjol.' },
    { key: 'about.learning', label: 'Sedang dipelajari', type: 'tags', half: true },
    { key: 'about.interests', label: 'Minat', type: 'tags', half: true },
    { key: 'softSkills', label: 'Soft skills', type: 'tags', help: 'Tampil di bawah daftar skill teknis.' }
  ];

  const LISTS = {
    skills: {
      title: 'Daftar skill', singular: 'Skill', icon: 'layers', addTo: 'end',
      desc: 'Urutan di sini = urutan tampil. Gunakan tombol panah untuk mengatur.',
      empty: 'Belum ada skill', emptyHint: 'Tambahkan bahasa pemrograman, framework, atau tools yang kamu kuasai.',
      fields: [
        { key: 'name', label: 'Nama skill', type: 'text', required: true, placeholder: 'cth. Laravel', half: true },
        { key: 'category', label: 'Kategori', type: 'text', half: true, suggest: () => uniq('skills', 'category', ['Frontend', 'Backend', 'Mobile', 'AI & Data', 'Tools', 'Desain']) },
        { key: 'icon', label: 'Ikon', type: 'devicon', help: 'Nama ikon dari <a href="https://devicon.dev" target="_blank" rel="noopener">devicon.dev</a> (cth. <code>laravel</code>, <code>python</code>, <code>figma</code>) atau URL gambar. Kosongkan untuk mendeteksi otomatis dari nama.' },
        { key: 'level', label: 'Tingkat penguasaan', type: 'range', min: 0, max: 100, step: 5 }
      ],
      defaults: () => ({ name: '', icon: '', category: 'Frontend', level: 70 }),
      label: (i) => i.name,
      sub: (i) => `${i.category || 'Tanpa kategori'} · ${levelLabel(i.level)} (${Number(i.level) || 0}%)`,
      thumb: (i) => techIcon(i.name || '?', i.icon)
    },
    projects: {
      title: 'Daftar proyek', singular: 'Proyek', icon: 'folder', addTo: 'start',
      desc: 'Tandai proyek terbaik sebagai "Unggulan" agar tampil lebih besar.',
      empty: 'Belum ada proyek', emptyHint: 'Tambahkan tugas besar, proyek pribadi, atau hasil lomba.',
      fields: [
        { type: 'group', label: 'Informasi utama' },
        { key: 'title', label: 'Judul proyek', type: 'text', required: true },
        { key: 'category', label: 'Kategori', type: 'text', half: true, suggest: () => uniq('projects', 'category', ['Web App', 'Mobile App', 'AI / Machine Learning', 'UI/UX Design', 'Program', 'Game']) },
        { key: 'date', label: 'Waktu pengerjaan', type: 'month', half: true },
        { key: 'featured', label: 'Unggulan', type: 'toggle', text: 'Tampilkan besar di atas', half: true },
        { key: 'hidden', label: 'Visibilitas', type: 'toggle', text: 'Sembunyikan dari situs', half: true },
        { key: 'description', label: 'Ringkasan (tampil di kartu)', type: 'textarea', rows: 3, help: 'Satu sampai dua kalimat yang menjelaskan proyek.' },
        { key: 'longDescription', label: 'Deskripsi lengkap (tampil di detail)', type: 'textarea', rows: 6, help: 'Ceritakan latar belakang, peranmu, dan hasilnya. Pisahkan paragraf dengan baris kosong.' },
        { key: 'features', label: 'Fitur / poin penting', type: 'lines', rows: 5, help: 'Satu poin per baris.' },
        { key: 'tags', label: 'Teknologi', type: 'tags', placeholder: 'cth. React, lalu Enter', suggest: () => (state.data.skills || []).map((s) => s.name) },
        { type: 'group', label: 'Media' },
        { key: 'image', label: 'Gambar sampul', type: 'image', folder: 'projects', help: 'Screenshot rasio 16:10 terlihat paling bagus. Jika kosong, sampul dibuat otomatis.' },
        { key: 'gallery', label: 'Galeri tambahan', type: 'images', folder: 'projects' },
        { type: 'group', label: 'Tautan' },
        { key: 'demo', label: 'Link demo / website', type: 'url', placeholder: 'https://', half: true },
        { key: 'repo', label: 'Link source code', type: 'url', placeholder: 'https://github.com/…', half: true },
        { key: 'video', label: 'Link video demo', type: 'url', placeholder: 'https://youtube.com/…' }
      ],
      defaults: () => ({ id: '', title: '', category: 'Web App', date: thisMonth(), featured: false, description: '', longDescription: '', features: [], tags: [], image: '', gallery: [], demo: '', repo: '', video: '', hidden: false }),
      label: (i) => i.title,
      sub: (i) => [i.category, i.date ? fmtMonth(i.date) : '', (i.tags || []).slice(0, 3).join(', ')].filter(Boolean).join(' · '),
      thumb: (i) => (i.image ? `<img src="${esc(src(i.image))}" alt="">` : icon('folder')),
      thumbClass: (i) => (i.image ? '' : 'gen'),
      thumbHue: (i) => coverHue(i.title || ''),
      badges: (i) => (i.featured ? '<span class="li-badge">Unggulan</span>' : '') + (i.hidden ? '<span class="li-badge muted">Disembunyikan</span>' : '')
    },
    certificates: {
      title: 'Daftar sertifikat', singular: 'Sertifikat', icon: 'award', addTo: 'start',
      desc: 'Unggah gambar atau PDF sertifikat. Pengunjung bisa memperbesar atau membukanya.',
      empty: 'Belum ada sertifikat', emptyHint: 'Tambahkan sertifikat kursus (Dicoding, Coursera, dll), pelatihan, seminar, atau lomba.',
      fields: [
        { key: 'title', label: 'Nama sertifikat', type: 'text', required: true },
        { key: 'issuer', label: 'Penerbit / penyelenggara', type: 'text', half: true, placeholder: 'cth. Dicoding Indonesia' },
        { key: 'category', label: 'Kategori', type: 'text', half: true, suggest: () => uniq('certificates', 'category', ['Kursus Online', 'Pelatihan', 'Kompetisi', 'Seminar', 'Bootcamp', 'Sertifikasi Profesional']) },
        { key: 'date', label: 'Tanggal terbit', type: 'month', half: true },
        { key: 'credentialId', label: 'ID kredensial', type: 'text', half: true },
        { key: 'image', label: 'File sertifikat (gambar / PDF)', type: 'file', accept: 'image/*,application/pdf', folder: 'certificates' },
        { key: 'url', label: 'Link verifikasi', type: 'url', placeholder: 'https://' },
        { key: 'description', label: 'Keterangan singkat', type: 'textarea', rows: 3 },
        { key: 'hidden', label: 'Visibilitas', type: 'toggle', text: 'Sembunyikan dari situs' }
      ],
      defaults: () => ({ title: '', issuer: '', category: 'Kursus Online', date: thisMonth(), credentialId: '', url: '', image: '', description: '', hidden: false }),
      label: (i) => i.title,
      sub: (i) => [i.issuer, i.date ? fmtMonth(i.date) : '', i.category].filter(Boolean).join(' · '),
      thumb: (i) => (i.image && !isPdfPath(i.image) ? `<img src="${esc(src(i.image))}" alt="">` : icon(i.image ? 'file' : 'award')),
      badges: (i) => (i.hidden ? '<span class="li-badge muted">Disembunyikan</span>' : '') + (i.image && isPdfPath(i.image) ? '<span class="li-badge muted">PDF</span>' : '')
    },
    experience: {
      title: 'Pengalaman & organisasi', singular: 'Pengalaman', icon: 'briefcase', addTo: 'start',
      desc: 'Magang, kerja, freelance, organisasi kampus, kepanitiaan, asisten lab, dll.',
      empty: 'Belum ada pengalaman', emptyHint: 'Selama kosong, situs menampilkan ajakan untuk berkolaborasi.',
      fields: [
        { key: 'role', label: 'Posisi / peran', type: 'text', required: true, half: true, placeholder: 'cth. Frontend Developer Intern' },
        { key: 'organization', label: 'Perusahaan / organisasi', type: 'text', half: true },
        { key: 'type', label: 'Jenis', type: 'select', half: true, options: ['Magang', 'Kerja', 'Freelance', 'Organisasi', 'Kepanitiaan', 'Volunteer', 'Asisten Lab', 'Lomba', 'Lainnya'] },
        { key: 'location', label: 'Lokasi', type: 'text', half: true, placeholder: 'cth. Bekasi / Remote' },
        { key: 'start', label: 'Mulai', type: 'month', half: true },
        { key: 'end', label: 'Selesai', type: 'month', half: true, help: 'Kosongkan jika masih berjalan.' },
        { key: 'description', label: 'Deskripsi', type: 'textarea', rows: 3 },
        { key: 'points', label: 'Pencapaian / tanggung jawab', type: 'lines', rows: 4, help: 'Satu poin per baris.' },
        { key: 'hidden', label: 'Visibilitas', type: 'toggle', text: 'Sembunyikan dari situs' }
      ],
      defaults: () => ({ role: '', organization: '', type: 'Magang', location: '', start: thisMonth(), end: '', description: '', points: [], hidden: false }),
      label: (i) => i.role,
      sub: (i) => [i.organization, i.type, `${i.start ? fmtMonth(i.start) : '…'} — ${i.end ? fmtMonth(i.end) : 'Sekarang'}`].filter(Boolean).join(' · '),
      thumb: () => icon('briefcase'),
      badges: (i) => (i.hidden ? '<span class="li-badge muted">Disembunyikan</span>' : '')
    },
    education: {
      title: 'Riwayat pendidikan', singular: 'Pendidikan', icon: 'graduation', addTo: 'start',
      empty: 'Belum ada data pendidikan', emptyHint: '',
      fields: [
        { key: 'school', label: 'Nama institusi', type: 'text', required: true },
        { key: 'degree', label: 'Jenjang', type: 'text', half: true, placeholder: 'cth. Sarjana (S1)' },
        { key: 'major', label: 'Jurusan', type: 'text', half: true },
        { key: 'start', label: 'Mulai', type: 'month', half: true },
        { key: 'end', label: 'Selesai', type: 'month', half: true, help: 'Kosongkan jika masih berjalan.' },
        { key: 'gpa', label: 'IPK / nilai', type: 'text', half: true, placeholder: 'cth. 3.75', help: 'Opsional.' },
        { key: 'description', label: 'Deskripsi', type: 'textarea', rows: 3 },
        { key: 'points', label: 'Mata kuliah / pencapaian penting', type: 'lines', rows: 4, help: 'Satu poin per baris.' },
        { key: 'hidden', label: 'Visibilitas', type: 'toggle', text: 'Sembunyikan dari situs' }
      ],
      defaults: () => ({ school: '', degree: '', major: '', start: '', end: '', gpa: '', description: '', points: [], hidden: false }),
      label: (i) => i.school,
      sub: (i) => [i.degree, i.major, i.gpa ? 'IPK ' + i.gpa : ''].filter(Boolean).join(' · '),
      thumb: () => icon('graduation'),
      badges: (i) => (i.hidden ? '<span class="li-badge muted">Disembunyikan</span>' : '')
    },
    socials: {
      title: 'Media sosial', singular: 'Tautan', icon: 'link', addTo: 'end',
      desc: 'Tampil di hero, kontak, footer, dan pencarian cepat.',
      empty: 'Belum ada tautan', emptyHint: 'Tambahkan GitHub, LinkedIn, Instagram, dll.',
      fields: [
        { key: 'platform', label: 'Platform', type: 'select', half: true, options: Object.entries(SOCIALS).map(([k, v]) => [k, v.label]) },
        { key: 'label', label: 'Label (opsional)', type: 'text', half: true },
        { key: 'url', label: 'URL / alamat', type: 'text', required: true, help: 'URL lengkap (https://…). Untuk Email cukup alamat email, untuk WhatsApp cukup nomor.' }
      ],
      defaults: () => ({ platform: 'linkedin', url: '', label: '' }),
      label: (i) => i.label || (SOCIALS[i.platform] || SOCIALS.other).label,
      sub: (i) => i.url || '(belum diisi)',
      thumb: (i) => icon((SOCIALS[i.platform] || SOCIALS.other).icon)
    },
    services: {
      title: 'Fokus keahlian', singular: 'Fokus', icon: 'target', addTo: 'end',
      desc: 'Kartu "yang bisa saya kerjakan" di bagian Tentang. Idealnya 3 kartu.',
      empty: 'Belum ada fokus keahlian', emptyHint: '',
      fields: [
        { key: 'title', label: 'Judul', type: 'text', required: true },
        { key: 'description', label: 'Deskripsi', type: 'textarea', rows: 3 },
        { key: 'icon', label: 'Ikon', type: 'iconpick', options: SERVICE_ICONS }
      ],
      defaults: () => ({ icon: 'code', title: '', description: '' }),
      label: (i) => i.title,
      sub: (i) => i.description,
      thumb: (i) => icon(i.icon || 'sparkles')
    },
    stats: {
      title: 'Statistik tambahan', singular: 'Statistik', icon: 'chart', addTo: 'end',
      desc: 'Jumlah proyek, skill, sertifikat, dan repo GitHub dihitung otomatis. Tambahkan angka lain di sini, misalnya IPK atau jumlah lomba.',
      empty: 'Belum ada statistik tambahan', emptyHint: '',
      fields: [
        { key: 'value', label: 'Nilai', type: 'text', required: true, half: true, placeholder: 'cth. 3.80' },
        { key: 'label', label: 'Label', type: 'text', half: true, placeholder: 'cth. IPK' }
      ],
      defaults: () => ({ value: '', label: '' }),
      label: (i) => (i.value ? i.value + ' — ' : '') + (i.label || ''),
      sub: () => 'Statistik kustom',
      thumb: () => icon('chart')
    }
  };

  const SETTINGS_FIELDS = {
    github: [
      { key: 'settings.githubUsername', label: 'Username GitHub', type: 'text', half: true, help: 'Untuk statistik, grafik kontribusi, dan repositori terbaru.' },
      { key: 'settings.showGithub', label: 'Bagian GitHub', type: 'toggle', text: 'Tampilkan bagian Aktivitas GitHub', half: true }
    ],
    contact: [
      { key: 'settings.formEndpoint', label: 'Endpoint formulir (opsional)', type: 'url', placeholder: 'https://formspree.io/f/xxxxxxx', help: 'Agar pesan dari formulir kontak masuk langsung ke email kamu tanpa membuka aplikasi email: daftar gratis di <a href="https://formspree.io" target="_blank" rel="noopener">formspree.io</a>, buat form baru, lalu tempel endpoint-nya di sini. Jika kosong, formulir membuka aplikasi email / WhatsApp pengunjung.' }
    ],
    site: [
      { key: 'settings.timezone', label: 'Zona waktu (jam lokal)', type: 'select', half: true, options: [['Asia/Jakarta', 'WIB — Asia/Jakarta'], ['Asia/Makassar', 'WITA — Asia/Makassar'], ['Asia/Jayapura', 'WIT — Asia/Jayapura']] },
      { key: 'settings.siteUrl', label: 'URL situs', type: 'url', half: true, placeholder: 'https://nama.vercel.app', help: 'Opsional, untuk catatan.' }
    ]
  };

  const PRESETS = [
    ['Violet & Teal', '#8b7bff', '#2dd4bf'],
    ['Biru & Cyan', '#60a5fa', '#22d3ee'],
    ['Indigo & Pink', '#818cf8', '#f472b6'],
    ['Emerald & Lime', '#34d399', '#a3e635'],
    ['Rose & Amber', '#fb7185', '#fbbf24'],
    ['Oranye & Kuning', '#fb923c', '#facc15']
  ];

  /* =========================================================
     Form builder
     ========================================================= */
  function buildForm(fields, target, onChange) {
    const form = h('div', { class: 'form' });
    fields.forEach((def) => {
      if (def.type === 'group') { form.append(h('div', { class: 'f-group' }, def.label)); return; }
      const id = nextId();
      const wrap = h('div', { class: 'f' + (def.half ? ' half' : ''), 'data-key': def.key });
      const labelEl = ['toggle', 'tags', 'image', 'file', 'images', 'iconpick', 'range'].includes(def.type)
        ? h('div', { class: 'f-label' }, def.label)
        : h('label', { for: id }, def.label);
      if (def.required) labelEl.append(h('span', { class: 'req' }, '*'));
      wrap.append(labelEl, control(def, target, id, (k) => { wrap.classList.remove('invalid'); onChange(k); }));
      if (def.help) wrap.append(h('div', { class: 'help', html: def.help }));
      form.append(wrap);
    });
    return form;
  }

  function control(def, target, id, onChange) {
    const val = getPath(target, def.key);
    const set = (v) => { setPath(target, def.key, v); onChange(def.key); };
    switch (def.type) {
      case 'textarea': {
        const el = h('textarea', { id, rows: def.rows || 3, placeholder: def.placeholder || '' });
        el.value = val || '';
        el.addEventListener('input', () => set(el.value));
        return el;
      }
      case 'lines': {
        const el = h('textarea', { id, rows: def.rows || 4, placeholder: def.placeholder || '' });
        el.value = Array.isArray(val) ? val.join('\n') : '';
        el.addEventListener('input', () => set(el.value.split('\n').map((s) => s.trim()).filter(Boolean)));
        return el;
      }
      case 'paras': {
        const el = h('textarea', { id, rows: def.rows || 6 });
        el.value = Array.isArray(val) ? val.join('\n\n') : '';
        el.addEventListener('input', () => set(el.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)));
        return el;
      }
      case 'toggle': {
        const input = h('input', { type: 'checkbox', id });
        input.checked = !!val;
        input.addEventListener('change', () => set(input.checked));
        return h('label', { class: 'toggle', for: id }, input, h('span', { class: 'track' }), h('span', { class: 't-text' }, def.text || ''));
      }
      case 'range': {
        const v = Number(val) || 0;
        const input = h('input', { type: 'range', id, min: def.min ?? 0, max: def.max ?? 100, step: def.step ?? 1, value: v, 'aria-label': def.label });
        const out = h('output', {}, `${v}% · ${levelLabel(v)}`);
        input.addEventListener('input', () => { const n = Number(input.value); out.textContent = `${n}% · ${levelLabel(n)}`; set(n); });
        return h('div', { class: 'range-row' }, input, out);
      }
      case 'select': {
        const sel = h('select', { id });
        (def.options || []).forEach((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          sel.append(h('option', { value: v }, l));
        });
        if (val != null && ![...sel.options].some((o) => o.value === val) && val !== '') sel.append(h('option', { value: val }, val));
        sel.value = val ?? (def.options[0] && (Array.isArray(def.options[0]) ? def.options[0][0] : def.options[0]));
        if (val == null) setPath(target, def.key, sel.value);
        sel.addEventListener('change', () => set(sel.value));
        return sel;
      }
      case 'tags': return tagsControl(def, target, id, onChange);
      case 'image':
      case 'file': return mediaControl(def, target, onChange);
      case 'images': return galleryControl(def, target, onChange);
      case 'devicon': {
        const prev = h('span', { class: 'icon-prev' });
        const input = h('input', { type: 'text', id, placeholder: 'otomatis', value: val || '' });
        const draw = () => { prev.innerHTML = techIcon(target.name || '?', input.value.trim()); };
        input.addEventListener('input', () => { set(input.value.trim()); draw(); });
        draw();
        return h('div', { class: 'row' }, prev, h('div', { class: 'grow' }, input));
      }
      case 'iconpick': {
        const grid = h('div', { class: 'icon-grid' });
        (def.options || []).forEach((name) => {
          const b = h('button', { type: 'button', class: name === val ? 'active' : '', title: name, 'aria-label': name, html: icon(name) });
          b.addEventListener('click', () => { $$('button', grid).forEach((x) => x.classList.toggle('active', x === b)); set(name); });
          grid.append(b);
        });
        return grid;
      }
      case 'color': {
        const color = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#8b7bff', 'aria-label': def.label });
        const text = h('input', { type: 'text', id, value: val || '', placeholder: '#8b7bff' });
        color.addEventListener('input', () => { text.value = color.value; set(color.value); applyAccent(); });
        text.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) { color.value = text.value; set(text.value); applyAccent(); } });
        return h('div', { class: 'color-row' }, color, text);
      }
      default: {
        const type = { url: 'url', email: 'email', month: 'month', number: 'number' }[def.type] || 'text';
        const input = h('input', { type, id, placeholder: def.placeholder || (def.type === 'month' ? 'YYYY-MM' : ''), autocomplete: 'off' });
        input.value = val ?? '';
        if (def.suggest) attachList(input, def.suggest());
        input.addEventListener('input', () => set(type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value));
        return input;
      }
    }
  }

  function attachList(input, options) {
    const lid = nextId();
    const dl = h('datalist', { id: lid });
    options.forEach((o) => dl.append(h('option', { value: o })));
    input.setAttribute('list', lid);
    setTimeout(() => (input.parentNode ? input.after(dl) : document.body.append(dl)), 0);
  }

  function tagsControl(def, target, id, onChange) {
    const wrap = h('div', { class: 'tags-input' });
    const input = h('input', { type: 'text', id, placeholder: def.placeholder || 'Ketik lalu tekan Enter' });
    const arr = () => (Array.isArray(getPath(target, def.key)) ? getPath(target, def.key) : []);
    const commit = (a) => { setPath(target, def.key, a); draw(); onChange(def.key); };
    function draw() {
      $$('.tg', wrap).forEach((n) => n.remove());
      arr().forEach((t, i) => {
        const rm = h('button', { type: 'button', 'aria-label': 'Hapus ' + t, html: icon('x') });
        rm.addEventListener('click', (e) => { e.stopPropagation(); const a = arr().slice(); a.splice(i, 1); commit(a); });
        wrap.insertBefore(h('span', { class: 'tg' }, t, rm), input);
      });
    }
    function add(raw) {
      const vals = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
      input.value = '';
      if (!vals.length) return;
      const a = arr().slice();
      vals.forEach((v) => { if (!a.some((x) => x.toLowerCase() === v.toLowerCase())) a.push(v); });
      commit(a);
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); }
      else if (e.key === 'Backspace' && !input.value && arr().length) { const a = arr().slice(); a.pop(); commit(a); }
    });
    input.addEventListener('blur', () => add(input.value));
    wrap.addEventListener('click', () => input.focus());
    wrap.append(input);
    if (def.suggest) attachList(input, def.suggest());
    draw();
    return wrap;
  }

  async function compressImage(file, maxW) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Gambar tidak dapat dibaca')); i.src = url; });
      const scale = Math.min(1, maxW / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale === 1 && file.size < 450 * 1024) return file;
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let out = await new Promise((res) => c.toBlob(res, 'image/webp', 0.86));
      if (!out || out.type !== 'image/webp') out = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
      if (!out) return file;
      return scale < 1 || out.size < file.size ? out : file;
    } finally { URL.revokeObjectURL(url); }
  }

  async function storeUpload(file, folder, maxW = 1600) {
    const MAX = 10 * 1024 * 1024;
    let blob = file;
    let ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    if (/^image\/(png|jpeg|webp)$/.test(file.type)) {
      blob = await compressImage(file, maxW);
      if (blob !== file) ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    } else if (!/^image\/(svg\+xml|gif|avif)$/.test(file.type) && file.type !== 'application/pdf') {
      throw new Error('Format tidak didukung. Gunakan JPG, PNG, WebP, SVG, GIF, atau PDF.');
    }
    if (blob.size > MAX) throw new Error('Ukuran file maksimal 10 MB.');
    const dataUrl = await readAsDataURL(blob);
    const base = slug(file.name.replace(/\.[^.]+$/, '')).slice(0, 40) || 'file';
    const path = `assets/uploads/${folder}/${Date.now().toString(36)}-${base}.${ext}`;
    await files.set(path, { dataUrl, type: blob.type || file.type, name: file.name, size: blob.size });
    return path;
  }

  function mediaControl(def, target, onChange) {
    const isImage = def.type === 'image';
    const wrap = h('div', { class: 'media dropzone' });
    const prev = h('div', { class: 'media-prev' + (def.square ? ' square' : '') });
    const pathInput = h('input', { type: 'text', placeholder: 'Path atau URL (otomatis terisi setelah unggah)', 'aria-label': def.label + ' (path)' });
    const fileInput = h('input', { type: 'file', accept: def.accept || (isImage ? 'image/*' : '*/*'), hidden: true });
    const up = h('button', { type: 'button', class: 'btn btn-ghost btn-xs', html: icon('upload') + ' Unggah file' });
    const del = h('button', { type: 'button', class: 'btn btn-danger-ghost btn-xs', html: icon('trash') + ' Hapus' });
    const set = (v) => { setPath(target, def.key, v); draw(); onChange(def.key); };
    function draw() {
      const v = getPath(target, def.key) || '';
      pathInput.value = v;
      del.hidden = !v;
      if (!v) prev.innerHTML = `<div class="file-badge">${icon(isImage ? 'image' : 'file')}<span>Kosong</span></div>`;
      else if (isPdfPath(v)) prev.innerHTML = `<div class="file-badge">${icon('file')}<span>PDF</span></div>`;
      else prev.innerHTML = `<img src="${esc(src(v))}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'file-badge',textContent:'Pratinjau belum tersedia'}))">`;
      if (files.map.has(v)) prev.insertAdjacentHTML('beforeend', '<span class="pending">BARU</span>');
    }
    async function handle(f) {
      up.disabled = true; up.innerHTML = '<span class="spinner"></span> Memproses…';
      try {
        const path = await storeUpload(f, def.folder || 'misc', def.maxW || 1600);
        set(path);
        toast('File siap. Akan diunggah ke GitHub saat kamu menekan Publikasikan.');
      } catch (e) { toast(e.message, 'err'); }
      finally { up.disabled = false; up.innerHTML = icon('upload') + ' Unggah file'; }
    }
    up.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handle(fileInput.files[0]); fileInput.value = ''; });
    del.addEventListener('click', () => set(''));
    pathInput.addEventListener('change', () => set(pathInput.value.trim()));
    wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.classList.add('drag'); });
    wrap.addEventListener('dragleave', () => wrap.classList.remove('drag'));
    wrap.addEventListener('drop', (e) => { e.preventDefault(); wrap.classList.remove('drag'); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    wrap.append(prev, h('div', { class: 'media-side' }, h('div', { class: 'media-actions' }, up, del), pathInput, h('div', { class: 'help' }, 'Bisa juga seret & lepas file ke sini.'), fileInput));
    draw();
    return wrap;
  }

  function galleryControl(def, target, onChange) {
    const grid = h('div', { class: 'gallery' });
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const arr = () => (Array.isArray(getPath(target, def.key)) ? getPath(target, def.key) : []);
    function draw() {
      grid.innerHTML = '';
      arr().forEach((p, i) => {
        const rm = h('button', { type: 'button', 'aria-label': 'Hapus gambar', html: icon('x') });
        rm.addEventListener('click', () => { const a = arr().slice(); a.splice(i, 1); setPath(target, def.key, a); draw(); onChange(def.key); });
        grid.append(h('div', { class: 'g-item' }, h('img', { src: src(p), alt: '' }), rm));
      });
      const add = h('button', { type: 'button', class: 'g-add', html: icon('plus') + '<span>Tambah</span>' });
      add.addEventListener('click', () => fileInput.click());
      grid.append(add, fileInput);
    }
    fileInput.addEventListener('change', async () => {
      const list = [...fileInput.files];
      fileInput.value = '';
      for (const f of list) {
        try { const p = await storeUpload(f, def.folder || 'gallery'); setPath(target, def.key, arr().concat(p)); }
        catch (e) { toast(e.message, 'err'); }
      }
      draw(); onChange(def.key);
    });
    draw();
    return grid;
  }

  /* =========================================================
     Draft & status
     ========================================================= */
  const isDirty = () => JSON.stringify(state.data) !== state.published;
  let saveTimer, refreshTimer;
  function changed() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 300);
    updateStatus();
  }
  function saveDraft() {
    clearTimeout(saveTimer);
    if (!state.data) return;
    if (isDirty()) {
      if (!store.set(PF.DRAFT_KEY, { data: state.data, savedAt: new Date().toISOString() })) toast('Penyimpanan browser penuh, draft tidak tersimpan.', 'err');
    } else store.remove(PF.DRAFT_KEY);
  }
  function refreshSoon() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => render({ keepScroll: true }), 250);
  }
  function updateStatus() {
    const d = isDirty();
    const el = $('#tbStatus');
    el.className = 'tb-status' + (d ? ' dirty' : '');
    el.innerHTML = `<span class="dot"></span>${d ? 'Belum dipublikasikan' : 'Sudah tersinkron'}`;
    $$('#sbNav .sb-item').forEach((b) => {
      const c = b.querySelector('.count');
      if (c) c.textContent = (state.data[b.dataset.sec] || []).length;
    });
    const dash = $('#dashStatus');
    if (dash) dash.replaceWith(statusPanel());
  }
  function applyAccent() {
    const s = state.data.settings || {};
    const hex = /^#[0-9a-f]{3,8}$/i;
    if (hex.test(s.accent || '')) document.documentElement.style.setProperty('--accent', s.accent);
    if (hex.test(s.accent2 || '')) document.documentElement.style.setProperty('--accent-2', s.accent2);
  }

  /* =========================================================
     GitHub API
     ========================================================= */
  const ghReady = () => !!(state.gh.owner && state.gh.repo && state.gh.token);
  async function gh(path, opts = {}) {
    const { owner, repo, token } = state.gh;
    const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) }, cache: 'no-store' });
    } catch (e) {
      const err = new Error('Tidak dapat terhubung ke GitHub. Periksa koneksi internet.'); err.status = 0; throw err;
    }
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch (e) { /* ignore */ }
      const err = new Error(msg); err.status = res.status; throw err;
    }
    if (opts.raw) return res.text();
    return res.status === 204 ? null : res.json();
  }
  const ghRaw = (path) => gh(`/contents/${path}?ref=${encodeURIComponent(state.gh.branch || 'main')}`, { raw: true, headers: { Accept: 'application/vnd.github.raw+json' } });

  async function gitCommit(list, message, onProgress) {
    const branch = state.gh.branch || 'main';
    const ref = await gh(`/git/ref/heads/${branch}`);
    const baseSha = ref.object.sha;
    const base = await gh(`/git/commits/${baseSha}`);
    const tree = [];
    for (let i = 0; i < list.length; i++) {
      onProgress && onProgress(i + 1, list.length);
      const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: list[i].content, encoding: 'base64' }) });
      tree.push({ path: list[i].path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const newTree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
    const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }) });
    await gh(`/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    return commit;
  }

  function ghErrorText(e) {
    switch (e.status) {
      case 0: return e.message;
      case 401: return 'Token GitHub tidak valid atau sudah kedaluwarsa. Buat token baru di halaman Koneksi GitHub.';
      case 403: return 'Token tidak punya izin menulis. Pastikan izin "Contents: Read and write" aktif untuk repositori ini. (' + e.message + ')';
      case 404: return 'Repositori atau branch tidak ditemukan, atau token tidak punya akses ke repositori ini.';
      case 409: case 422: return 'Terjadi konflik di GitHub. Coba publikasikan sekali lagi. (' + e.message + ')';
      default: return 'GitHub: ' + e.message;
    }
  }

  function renderGhPill() {
    const pill = $('#ghPill');
    const ok = ghReady();
    pill.className = 'gh-pill' + (ok && state.ghOk !== false ? ' ok' : '');
    pill.innerHTML = `<span class="dot"></span><span>${ok ? esc(state.gh.owner + '/' + state.gh.repo) : 'GitHub belum terhubung'}</span>`;
    pill.onclick = () => go('github');
    pill.title = ok ? 'Terhubung ke GitHub' : 'Klik untuk menghubungkan GitHub';
  }

  /* =========================================================
     Load & publish
     ========================================================= */
  async function load() {
    let text = null;
    state.remoteText = null;
    if (ghReady()) {
      try { text = await ghRaw(PF.DATA_PATH); state.remoteText = text; state.ghOk = true; }
      catch (e) { state.ghOk = false; toast('Gagal memuat dari GitHub: ' + ghErrorText(e), 'warn'); }
    }
    if (text == null) {
      const res = await fetch('/' + PF.DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Tidak bisa memuat data/portfolio.json (' + res.status + ')');
      text = await res.text();
    }
    const published = ensureShape(JSON.parse(text));
    state.published = JSON.stringify(published);
    await files.all();
    const draft = store.get(PF.DRAFT_KEY);
    $('#banner').hidden = true;
    if (draft && draft.data && JSON.stringify(ensureShape(draft.data)) !== state.published) {
      state.data = ensureShape(draft.data);
      showBanner(`Melanjutkan draft yang belum dipublikasikan (disimpan ${relTime(draft.savedAt)}).`, 'Buang draft', async () => {
        const ok = await dialog({ title: 'Buang draft?', message: 'Semua perubahan yang belum dipublikasikan akan hilang dan data kembali ke versi yang sedang tayang.', icon: 'trash', tone: 'danger', actions: [{ label: 'Batal', value: false }, { label: 'Buang draft', danger: true, value: true }] });
        if (!ok) return;
        state.data = JSON.parse(state.published);
        await files.clear();
        store.remove(PF.DRAFT_KEY);
        $('#banner').hidden = true;
        changed(); render(); applyAccent();
        toast('Draft dibuang');
      });
    } else {
      state.data = JSON.parse(state.published);
    }
  }

  function showBanner(text, actionLabel, action) {
    const b = $('#banner');
    b.innerHTML = '';
    b.append(h('span', { html: icon('info') }), h('span', { class: 'grow' }, text));
    if (actionLabel) b.append(h('button', { type: 'button', class: 'btn btn-ghost btn-xs', onclick: action }, actionLabel));
    b.hidden = false;
  }

  function ensureIds() {
    const used = new Set();
    state.data.projects.forEach((p) => {
      let id = p.id || slug(p.title);
      let n = 2;
      const base = id;
      while (used.has(id)) id = base + '-' + n++;
      used.add(id);
      p.id = id;
    });
  }

  function validate() {
    const d = state.data, issues = [];
    if (!String(d.profile.name || '').trim()) issues.push('Nama lengkap di Profil masih kosong.');
    d.projects.forEach((p, i) => { if (!String(p.title || '').trim()) issues.push(`Proyek #${i + 1} belum punya judul.`); });
    d.certificates.forEach((c, i) => { if (!String(c.title || '').trim()) issues.push(`Sertifikat #${i + 1} belum punya nama.`); });
    d.skills.forEach((s, i) => { if (!String(s.name || '').trim()) issues.push(`Skill #${i + 1} belum punya nama.`); });
    d.socials.forEach((s, i) => { if (!String(s.url || '').trim()) issues.push(`Tautan media sosial #${i + 1} belum diisi.`); });
    return issues;
  }

  function progressDialog(steps) {
    const dlg = $('#dialog');
    const box = h('div', { class: 'progress' });
    const rows = steps.map((s) => h('div', { html: `<span class="spinner"></span><span>${esc(s)}</span>` }));
    rows.forEach((r) => box.append(r));
    const show = () => {
      $('#dialogIc').className = 'dialog-ic'; $('#dialogIc').innerHTML = icon('rocket');
      $('#dialogTitle').textContent = 'Mempublikasikan…';
      const msg = $('#dialogMsg'); msg.innerHTML = '<p>Jangan tutup halaman ini sampai selesai.</p>'; msg.append(box);
      $('#dialogActions').innerHTML = '';
      dlg.classList.add('open'); dlg.setAttribute('aria-hidden', 'false');
    };
    show();
    return {
      done(i, label) { const r = rows[i]; if (!r) return; r.classList.add('done'); r.innerHTML = icon('check') + `<span>${esc(label || steps[i])}</span>`; },
      text(i, label) { const r = rows[i]; if (r) r.lastChild.textContent = label; },
      show,
      hide() { dlg.classList.remove('open'); dlg.setAttribute('aria-hidden', 'true'); }
    };
  }

  async function publish() {
    saveDraft();
    if (!ghReady()) {
      const goGh = await dialog({ title: 'Hubungkan GitHub dulu', message: '<p>Untuk mempublikasikan, panel admin butuh token GitHub yang punya akses ke repositori portfolio. Cukup diatur sekali di setiap perangkat.</p><p>Sementara itu, draft kamu tetap tersimpan otomatis di browser ini.</p>', icon: 'github', actions: [{ label: 'Nanti saja', value: false }, { label: 'Hubungkan sekarang', primary: true, value: true }] });
      if (goGh) go('github');
      return;
    }
    await files.all();
    if (!isDirty()) { toast('Tidak ada perubahan untuk dipublikasikan.', 'warn'); return; }
    const issues = validate();
    if (issues.length) {
      const ok = await dialog({ title: 'Ada data yang belum lengkap', message: `<p>${issues.slice(0, 6).map(esc).join('<br>')}${issues.length > 6 ? '<br>…' : ''}</p><p>Tetap publikasikan?</p>`, icon: 'alert', actions: [{ label: 'Perbaiki dulu', value: false }, { label: 'Tetap publikasikan', primary: true, value: true }] });
      if (!ok) return;
    }
    const btn = $('#btnPublish');
    btn.disabled = true;
    const prog = progressDialog(['Memeriksa versi terbaru di GitHub', 'Mengunggah data & file', 'Membuat commit']);
    try {
      let remote = null;
      try { remote = await ghRaw(PF.DATA_PATH); } catch (e) { if (e.status !== 404) throw e; }
      if (state.remoteText != null && remote != null && remote !== state.remoteText) {
        prog.hide();
        const ok = await dialog({ title: 'Data di GitHub sudah berubah', message: '<p>Portfolio sepertinya diperbarui dari perangkat lain sejak halaman ini dibuka.</p><p>Jika dilanjutkan, versi di GitHub akan <b>ditimpa</b> oleh draft ini.</p>', icon: 'alert', tone: 'danger', actions: [{ label: 'Batal', value: false }, { label: 'Timpa & publikasikan', danger: true, value: true }] });
        if (!ok) return;
        prog.show();
      }
      prog.done(0);

      ensureIds();
      state.data.meta = Object.assign({}, state.data.meta, { updatedAt: new Date().toISOString() });
      const json = JSON.stringify(state.data, null, 2) + '\n';
      const pending = [...files.map.entries()].filter(([p]) => json.includes(JSON.stringify(p)));
      const list = [{ path: PF.DATA_PATH, content: utf8ToB64(json) }]
        .concat(pending.map(([p, v]) => ({ path: p, content: String(v.dataUrl).split(',')[1] })));
      const stamp = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      const commit = await gitCommit(list, `Perbarui portfolio via admin (${stamp})`, (i, n) => {
        if (i === n) prog.done(1, `Mengunggah data & ${pending.length} file`);
        else prog.text(1, `Mengunggah ${i}/${n} file…`);
      });
      prog.done(1, `Data & ${pending.length} file terunggah`);
      prog.done(2);

      pending.forEach(([p, v]) => recent.set(p, v.dataUrl));
      await files.clear();
      state.remoteText = json;
      state.published = JSON.stringify(state.data);
      state.ghOk = true;
      store.remove(PF.DRAFT_KEY);
      $('#banner').hidden = true;
      prog.hide();
      updateStatus(); renderGhPill(); render({ keepScroll: true });
      dialog({
        title: 'Berhasil dipublikasikan! 🎉',
        message: '<p>Perubahan sudah tersimpan di GitHub. Vercel akan membangun ulang situs secara otomatis, biasanya dalam <b>30–60 detik</b>.</p><p>Jika situs belum berubah, tunggu sebentar lalu muat ulang (Ctrl + F5).</p>',
        icon: 'check', tone: 'success',
        actions: [{ label: 'Lihat commit', href: commit.html_url }, { label: 'Tutup', value: true }, { label: 'Buka situs', href: '/', primary: true }]
      });
    } catch (e) {
      prog.hide();
      console.error(e);
      dialog({ title: 'Gagal mempublikasikan', message: `<p>${esc(ghErrorText(e))}</p><p>Draft kamu aman dan tetap tersimpan.</p>`, icon: 'alert', tone: 'danger', actions: [{ label: 'Tutup', value: true }] });
    } finally {
      btn.disabled = false;
    }
  }

  function preview() {
    saveDraft();
    window.open('/?preview=1', 'pf-preview');
  }

  /* =========================================================
     Dialog & drawer
     ========================================================= */
  let dialogOpen = false;
  function dialog({ title, message = '', icon: ic = 'info', tone = '', actions = [{ label: 'OK', primary: true, value: true }] }) {
    return new Promise((resolve) => {
      const dlg = $('#dialog');
      $('#dialogIc').className = 'dialog-ic ' + tone;
      $('#dialogIc').innerHTML = icon(ic);
      $('#dialogTitle').textContent = title;
      $('#dialogMsg').innerHTML = message;
      const acts = $('#dialogActions');
      acts.innerHTML = '';
      const close = (v) => {
        dlg.classList.remove('open'); dlg.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onKey, true);
        dialogOpen = false;
        resolve(v);
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
      actions.forEach((a) => {
        const cls = 'btn btn-sm ' + (a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : 'btn-ghost');
        const el = a.href
          ? h('a', { class: cls, href: a.href, target: '_blank', rel: 'noopener' }, a.label)
          : h('button', { class: cls, type: 'button' }, a.label);
        el.addEventListener('click', () => close(a.value));
        acts.append(el);
      });
      document.addEventListener('keydown', onKey, true);
      dialogOpen = true;
      dlg.classList.add('open'); dlg.setAttribute('aria-hidden', 'false');
      setTimeout(() => { const b = acts.querySelector('.btn-primary, .btn-danger') || acts.querySelector('.btn'); if (b) b.focus(); }, 60);
    });
  }
  const confirmDelete = (what) => dialog({
    title: `Hapus ${what}?`, message: 'Item akan dihapus dari draft. Perubahan baru berlaku di situs setelah kamu menekan Publikasikan.',
    icon: 'trash', tone: 'danger', actions: [{ label: 'Batal', value: false }, { label: 'Hapus', danger: true, value: true }]
  });

  let drawerCtx = null;
  function openDrawer({ kicker, fields, target, titleOf, fallback, onChange, onDelete, onClose }) {
    drawerCtx = { onClose };
    $('#drawerKicker').textContent = kicker;
    const setTitle = () => { $('#drawerTitle').textContent = titleOf(target) || fallback; };
    setTitle();
    const body = $('#drawerBody');
    body.innerHTML = '';
    body.scrollTop = 0;
    body.append(buildForm(fields, target, (k) => { onChange(k); setTitle(); }));
    const del = $('#drawerDelete');
    del.hidden = !onDelete;
    del.onclick = async () => {
      if (!(await confirmDelete(fallback.toLowerCase()))) return;
      closeDrawer(true);
      onDelete();
    };
    const dr = $('#drawer');
    dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false');
    setTimeout(() => { const f = body.querySelector('input:not([type=checkbox]):not([type=file]):not([type=color]), textarea'); if (f) f.focus({ preventScroll: true }); }, 350);
  }
  function closeDrawer(skipCallback) {
    const dr = $('#drawer');
    if (!dr.classList.contains('open')) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // commit input tag yg tersisa
    dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true');
    const ctx = drawerCtx; drawerCtx = null;
    if (!skipCallback && ctx && ctx.onClose) ctx.onClose();
  }

  /* =========================================================
     List editor
     ========================================================= */
  function listPanel(key) {
    const cfg = LISTS[key];
    const arr = state.data[key];
    const panel = h('section', { class: 'panel' });
    const tools = h('div', { class: 'list-tools' });
    const list = h('div', { class: 'list' });
    let q = '';
    if (arr.length > 6) {
      const s = h('input', { type: 'search', placeholder: 'Cari…', 'aria-label': 'Cari ' + cfg.singular });
      s.addEventListener('input', () => { q = s.value.trim().toLowerCase(); draw(); });
      tools.append(h('label', { class: 'list-search', html: icon('search') }, s));
    }
    tools.append(h('button', { type: 'button', class: 'btn btn-primary btn-sm', html: icon('plus') + ' Tambah ' + esc(cfg.singular.toLowerCase()), onclick: () => addItem(key) }));
    panel.append(
      h('div', { class: 'panel-head' },
        h('div', {}, h('h2', { html: icon(cfg.icon) + esc(cfg.title) + ` <span class="muted" style="font-weight:500;font-size:14px">(${arr.length})</span>` }), cfg.desc ? h('p', {}, cfg.desc) : null),
        tools),
      list);

    const iconBtn = (name, label, disabled, fn, cls = '') => {
      const b = h('button', { type: 'button', class: 'icon-btn sm ' + cls, title: label, 'aria-label': label, disabled, html: icon(name) });
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    function draw() {
      list.innerHTML = '';
      if (!arr.length) {
        list.append(h('div', { class: 'list-empty', html: `${icon(cfg.icon)}<strong>${esc(cfg.empty)}</strong><span>${esc(cfg.emptyHint || '')}</span>` },
          h('div', {}, h('button', { type: 'button', class: 'btn btn-primary btn-sm', html: icon('plus') + ' Tambah ' + esc(cfg.singular.toLowerCase()), onclick: () => addItem(key) }))));
        return;
      }
      let shown = 0;
      arr.forEach((item, i) => {
        if (q && !JSON.stringify(item).toLowerCase().includes(q)) return;
        shown++;
        const thumbCls = cfg.thumbClass ? cfg.thumbClass(item) : '';
        const row = h('div', { class: 'li' + (item.hidden ? ' is-hidden' : ''), tabindex: '0', role: 'button', 'aria-label': 'Edit ' + (cfg.label(item) || cfg.singular) });
        row.innerHTML = `
          <div class="li-thumb ${thumbCls}" ${cfg.thumbHue ? `style="--h:${cfg.thumbHue(item)}"` : ''}>${cfg.thumb(item)}</div>
          <div class="li-main">
            <div class="li-title"><span style="overflow:hidden;text-overflow:ellipsis">${esc(cfg.label(item) || '(belum diberi judul)')}</span>${cfg.badges ? cfg.badges(item) : ''}</div>
            <div class="li-sub">${esc(cfg.sub(item) || '')}</div>
          </div>`;
        row.append(h('div', { class: 'li-actions' },
          iconBtn('chevron-up', 'Naikkan', i === 0, () => move(key, i, -1), 'hide-sm'),
          iconBtn('chevron-down', 'Turunkan', i === arr.length - 1, () => move(key, i, 1), 'hide-sm'),
          iconBtn('copy', 'Duplikat', false, () => duplicate(key, i), 'hide-sm'),
          iconBtn('pencil', 'Edit', false, () => editItem(key, item)),
          iconBtn('trash', 'Hapus', false, () => removeItem(key, item), 'danger')));
        row.addEventListener('click', () => editItem(key, item));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === row) editItem(key, item); });
        list.append(row);
      });
      if (!shown) list.append(h('div', { class: 'list-empty' }, 'Tidak ada yang cocok dengan pencarian.'));
    }
    draw();
    return panel;
  }

  function addItem(key) {
    const cfg = LISTS[key];
    const arr = state.data[key];
    const item = cfg.defaults();
    if (cfg.addTo === 'start') arr.unshift(item); else arr.push(item);
    changed(); render({ keepScroll: true });
    editItem(key, item, true);
  }
  function editItem(key, item, isNew) {
    const cfg = LISTS[key];
    const arr = state.data[key];
    openDrawer({
      kicker: (isNew ? 'Tambah ' : 'Edit ') + cfg.singular.toLowerCase(),
      fields: cfg.fields, target: item, titleOf: cfg.label, fallback: cfg.singular,
      onChange: () => { changed(); refreshSoon(); },
      onDelete: () => { const j = arr.indexOf(item); if (j >= 0) arr.splice(j, 1); changed(); render({ keepScroll: true }); toast(cfg.singular + ' dihapus'); },
      onClose: () => {
        const req = cfg.fields.filter((f) => f.required);
        const empty = req.length && req.every((f) => !String(getPath(item, f.key) || '').trim());
        if (empty) {
          const j = arr.indexOf(item);
          if (j >= 0) { arr.splice(j, 1); changed(); toast('Item kosong tidak disimpan', 'warn'); }
        }
        render({ keepScroll: true });
      }
    });
  }
  async function removeItem(key, item) {
    const cfg = LISTS[key];
    if (!(await confirmDelete(cfg.singular.toLowerCase()))) return;
    const arr = state.data[key];
    const j = arr.indexOf(item);
    if (j >= 0) arr.splice(j, 1);
    changed(); render({ keepScroll: true });
    toast(cfg.singular + ' dihapus');
  }
  function move(key, i, d) {
    const arr = state.data[key];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    changed(); render({ keepScroll: true });
  }
  function duplicate(key, i) {
    const arr = state.data[key];
    const copyItem = clone(arr[i]);
    const cfg = LISTS[key];
    ['title', 'name', 'role', 'school'].forEach((k) => { if (copyItem[k]) copyItem[k] += ' (salinan)'; });
    if ('id' in copyItem) copyItem.id = '';
    arr.splice(i + 1, 0, copyItem);
    changed(); render({ keepScroll: true });
    toast(cfg.singular + ' diduplikat');
  }

  /* =========================================================
     Halaman
     ========================================================= */
  function pageHead(title, desc, extra) {
    return h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, title), desc ? h('p', { html: desc }) : null), extra || null);
  }
  function formPanel(title, ic, fields, target, desc) {
    return h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('div', {}, h('h2', { html: icon(ic) + esc(title) }), desc ? h('p', { html: desc }) : null)),
      buildForm(fields, target, () => changed()));
  }

  function statusPanel() {
    const d = isDirty();
    const panel = h('section', { class: 'panel', id: 'dashStatus' });
    const updated = state.data.meta && state.data.meta.updatedAt;
    panel.append(h('div', { class: 'status-row' + (d ? ' dirty' : '') },
      h('span', { class: 'big-dot' }),
      h('div', { class: 'grow' },
        h('strong', {}, d ? 'Ada perubahan yang belum dipublikasikan' : 'Situs sudah menampilkan versi terbaru'),
        h('small', {}, d ? 'Draft tersimpan otomatis di browser ini. Tekan Publikasikan agar tampil di situs.' : (updated ? 'Terakhir dipublikasikan ' + fmtDate(updated) : 'Belum pernah dipublikasikan dari admin'))),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', html: icon('eye') + ' Pratinjau', onclick: preview }),
      d ? h('button', { type: 'button', class: 'btn btn-primary btn-sm', html: icon('rocket') + ' Publikasikan', onclick: publish }) : null));
    return panel;
  }

  function pageDashboard() {
    const d = state.data;
    const name = d.profile.nickname || String(d.profile.name || '').split(' ')[0] || '';
    const wrap = h('div');
    wrap.append(h('div', { class: 'page-head hello' }, h('div', {},
      h('h1', { html: `Halo, ${esc(name)} 👋` }),
      h('p', {}, 'Kelola seluruh isi portfolio dari sini. Setiap perubahan tersimpan otomatis sebagai draft sampai kamu menekan Publikasikan.'))));
    wrap.append(statusPanel());

    if (!ghReady()) {
      wrap.append(h('div', { class: 'callout warn', style: 'margin-bottom:18px', html: `${icon('github')}<div><b>GitHub belum terhubung di perangkat ini.</b> Kamu tetap bisa mengedit dan melihat pratinjau, tetapi untuk mempublikasikan perlu menghubungkan token GitHub (cukup sekali). <a href="#github">Hubungkan sekarang →</a></div>` }));
    }

    const cards = [['projects', 'Proyek', 'folder'], ['certificates', 'Sertifikat', 'award'], ['skills', 'Skill', 'layers'], ['experience', 'Pengalaman', 'briefcase']];
    wrap.append(h('div', { class: 'grid-4', style: 'margin-bottom:18px' }, cards.map(([k, l, ic]) =>
      h('button', { type: 'button', class: 'stat-card', onclick: () => go(k), html: `<div class="ic-wrap">${icon(ic)}</div><b>${d[k].length}</b><small>${l}</small>` }))));

    const quick = h('div', { class: 'quick' },
      [['projects', 'Tambah proyek'], ['certificates', 'Tambah sertifikat'], ['skills', 'Tambah skill'], ['experience', 'Tambah pengalaman']].map(([k, l]) =>
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', html: icon('plus') + ' ' + l, onclick: () => { go(k); addItem(k); } })));
    wrap.append(h('div', { class: 'grid-2' },
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', { html: icon('zap') + 'Aksi cepat' })),
        quick,
        h('div', { class: 'callout', style: 'margin-top:18px', html: `${icon('info')}<div>Tips: tandai 2–3 proyek terbaikmu sebagai <b>Unggulan</b>, dan isi <b>link demo</b> agar perekrut bisa langsung mencoba.</div>` })),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', { html: icon('rocket') + 'Cara kerja' })),
        h('ol', { class: 'steps', html: `
          <li><b>Edit</b> konten lewat menu di samping. Semua tersimpan otomatis sebagai draft.</li>
          <li><b>Pratinjau</b> untuk melihat hasilnya di situs sebelum tayang.</li>
          <li><b>Publikasikan</b> untuk menyimpan perubahan ke GitHub.</li>
          <li><b>Vercel</b> otomatis memperbarui situs dalam ±1 menit.</li>` }))));
    return wrap;
  }

  function pageList(key, title, desc) {
    const wrap = h('div');
    wrap.append(pageHead(title, desc));
    wrap.append(listPanel(key));
    return wrap;
  }

  function pageSettings() {
    const s = state.data.settings;
    const wrap = h('div');
    wrap.append(pageHead('Tampilan & situs', 'Atur warna aksen, bagian GitHub, formulir kontak, dan zona waktu.'));

    const swatches = h('div', { class: 'swatches' });
    const drawSw = () => {
      swatches.innerHTML = '';
      PRESETS.forEach(([name, a, b]) => {
        const active = (s.accent || '').toLowerCase() === a && (s.accent2 || '').toLowerCase() === b;
        swatches.append(h('button', {
          type: 'button', class: 'swatch' + (active ? ' active' : ''),
          html: `<i style="background:linear-gradient(120deg, ${a}, ${b})"></i>${esc(name)}`,
          onclick: () => { s.accent = a; s.accent2 = b; changed(); applyAccent(); render({ keepScroll: true }); }
        }));
      });
    };
    drawSw();
    wrap.append(h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('div', {}, h('h2', { html: icon('palette') + 'Warna aksen' }), h('p', {}, 'Dipakai untuk gradasi, tombol, dan sorotan di seluruh situs.'))),
      swatches,
      h('div', { style: 'height:18px' }),
      buildForm([
        { key: 'accent', label: 'Warna utama', type: 'color', half: true },
        { key: 'accent2', label: 'Warna kedua', type: 'color', half: true }
      ], s, () => { changed(); drawSw(); })));

    wrap.append(formPanel('Bagian GitHub', 'github', SETTINGS_FIELDS.github, state.data));
    wrap.append(formPanel('Formulir kontak', 'mail', SETTINGS_FIELDS.contact, state.data));
    wrap.append(h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { html: icon('globe') + 'Situs' })),
      buildForm(SETTINGS_FIELDS.site, state.data, (k) => {
        if (k === 'settings.timezone') s.timezoneLabel = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' }[s.timezone] || 'WIB';
        changed();
      })));
    return wrap;
  }

  function pageGithub() {
    const g = clone(state.gh);
    const wrap = h('div');
    wrap.append(pageHead('Koneksi GitHub', 'Panel admin menyimpan perubahan langsung ke repositori GitHub kamu. Setiap kali ada perubahan di GitHub, Vercel otomatis memperbarui situs.'));

    const status = h('div', { style: 'margin-bottom:18px' });
    const drawStatus = (msg, tone) => {
      const ok = ghReady() && state.ghOk !== false;
      status.innerHTML = '';
      status.append(h('div', {
        class: 'callout' + (tone === 'warn' || (!ok && !tone) ? ' warn' : ''),
        html: msg || (ok
          ? `${icon('check')}<div><b>Terhubung</b> ke <code>${esc(state.gh.owner)}/${esc(state.gh.repo)}</code> (branch <code>${esc(state.gh.branch)}</code>). Kamu bisa langsung mempublikasikan.</div>`
          : `${icon('alert')}<div><b>Belum terhubung.</b> Isi token di bawah lalu tekan <b>Simpan & uji koneksi</b>.</div>`)
      }));
    };
    drawStatus();
    wrap.append(status);

    const tokenInput = h('input', { type: 'password', id: 'ghToken', value: g.token, placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: 'false' });
    const eye = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Tampilkan token', html: icon('eye') });
    eye.addEventListener('click', () => { tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password'; eye.innerHTML = icon(tokenInput.type === 'password' ? 'eye' : 'eye-off'); });
    tokenInput.addEventListener('input', () => { g.token = tokenInput.value.trim(); });

    const form = buildForm([
      { key: 'owner', label: 'Username / pemilik repo', type: 'text', half: true },
      { key: 'repo', label: 'Nama repositori', type: 'text', half: true },
      { key: 'branch', label: 'Branch', type: 'text', half: true }
    ], g, () => {});
    form.append(h('div', { class: 'f' }, h('label', { for: 'ghToken' }, 'Personal access token'), h('div', { class: 'input-wrap' }, tokenInput, eye),
      h('div', { class: 'help' }, 'Disimpan hanya di browser perangkat ini (localStorage), tidak dikirim ke mana pun selain api.github.com.')));

    const saveBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', html: icon('check') + ' Simpan & uji koneksi' });
    const outBtn = h('button', { type: 'button', class: 'btn btn-danger-ghost btn-sm', html: icon('log-out') + ' Putuskan' });
    saveBtn.addEventListener('click', async () => {
      g.owner = String(g.owner || '').trim(); g.repo = String(g.repo || '').trim(); g.branch = String(g.branch || 'main').trim() || 'main';
      if (!g.owner || !g.repo || !g.token) { toast('Lengkapi username, repositori, dan token.', 'warn'); return; }
      saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span> Menguji…';
      const prev = state.gh;
      state.gh = g;
      try {
        const repo = await gh('');
        await gh(`/branches/${encodeURIComponent(g.branch)}`);
        store.set(PF.GH_KEY, g);
        state.ghOk = true;
        const canPush = !repo.permissions || repo.permissions.push;
        drawStatus(canPush ? null : `${icon('alert')}<div><b>Terhubung, tetapi akunmu tidak punya akses tulis</b> ke repositori ini.</div>`, canPush ? null : 'warn');
        toast('Koneksi GitHub berhasil');
        renderGhPill();
        // muat versi terbaru dari GitHub agar deteksi konflik akurat
        if (!isDirty()) { await load(); render({ keepScroll: true }); }
        else { try { state.remoteText = await ghRaw(PF.DATA_PATH); } catch (e) { /* ignore */ } }
      } catch (e) {
        state.gh = prev;
        state.ghOk = false;
        drawStatus(`${icon('alert')}<div><b>Gagal terhubung.</b> ${esc(ghErrorText(e))}</div>`, 'warn');
        renderGhPill();
      } finally {
        saveBtn.disabled = false; saveBtn.innerHTML = icon('check') + ' Simpan & uji koneksi';
      }
    });
    outBtn.addEventListener('click', async () => {
      const ok = await dialog({ title: 'Putuskan GitHub?', message: 'Token akan dihapus dari browser ini. Draft tetap tersimpan.', icon: 'log-out', actions: [{ label: 'Batal', value: false }, { label: 'Putuskan', danger: true, value: true }] });
      if (!ok) return;
      state.gh = Object.assign({}, state.gh, { token: '' });
      store.set(PF.GH_KEY, state.gh);
      state.ghOk = null;
      renderGhPill(); render();
      toast('Token dihapus dari perangkat ini');
    });

    wrap.append(h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { html: icon('key') + 'Pengaturan koneksi' })),
      form,
      h('div', { class: 'row', style: 'margin-top:20px;flex-wrap:wrap' }, saveBtn, ghReady() ? outBtn : null)));

    wrap.append(h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('div', {}, h('h2', { html: icon('book') + 'Cara membuat token (± 2 menit)' }), h('p', {}, 'Gunakan fine-grained token yang hanya bisa mengakses repositori portfolio ini.'))),
      h('ol', { class: 'steps', html: `
        <li>Buka <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" style="color:var(--accent)">github.com/settings/personal-access-tokens/new</a> (login dulu bila diminta).</li>
        <li>Isi <b>Token name</b>, misalnya <code>Portfolio Admin</code>, lalu pilih masa berlaku (misalnya 1 tahun).</li>
        <li>Pada <b>Repository access</b>, pilih <b>Only select repositories</b> lalu pilih repositori <code>${esc(g.repo || 'portfolio')}</code>.</li>
        <li>Di bagian <b>Permissions → Repository permissions</b>, ubah <b>Contents</b> menjadi <b>Read and write</b>.</li>
        <li>Klik <b>Generate token</b>, salin tokennya, tempel di kolom di atas, lalu tekan <b>Simpan & uji koneksi</b>.</li>` }),
      h('div', { class: 'callout warn', style: 'margin-top:18px', html: `${icon('shield')}<div><b>Keamanan:</b> jangan bagikan token dan jangan menyimpannya di komputer umum atau milik orang lain. Jika perangkat hilang, hapus token di halaman GitHub tadi.</div>` })));
    return wrap;
  }

  function pageBackup() {
    const wrap = h('div');
    wrap.append(pageHead('Backup & reset', 'Simpan cadangan data, pulihkan dari file, atau kembalikan draft ke versi yang sedang tayang.'));
    const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    importInput.addEventListener('change', async () => {
      const f = importInput.files[0];
      importInput.value = '';
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (!obj || typeof obj !== 'object' || !obj.profile) throw new Error('File bukan data portfolio yang valid.');
        const ok = await dialog({ title: 'Pulihkan dari file?', message: 'Draft saat ini akan diganti dengan isi file. Situs baru berubah setelah kamu menekan Publikasikan.', icon: 'upload', actions: [{ label: 'Batal', value: false }, { label: 'Pulihkan', primary: true, value: true }] });
        if (!ok) return;
        state.data = ensureShape(obj);
        changed(); applyAccent(); render();
        toast('Data dipulihkan ke draft');
      } catch (e) { toast(e.message || 'File tidak valid', 'err'); }
    });
    wrap.append(h('div', { class: 'grid-2' },
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('div', {}, h('h2', { html: icon('download') + 'Ekspor data' }), h('p', {}, 'Unduh seluruh data (draft saat ini) sebagai file JSON.'))),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', html: icon('download') + ' Unduh portfolio.json', onclick: () => download('portfolio-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(state.data, null, 2)) }),
        h('p', { class: 'muted', style: 'font-size:13px;margin-top:12px' }, 'Gambar yang belum dipublikasikan tidak ikut di file ini.')),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('div', {}, h('h2', { html: icon('upload') + 'Impor data' }), h('p', {}, 'Pulihkan dari file JSON hasil ekspor.'))),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', html: icon('upload') + ' Pilih file JSON', onclick: () => importInput.click() }), importInput)));
    wrap.append(h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('div', {}, h('h2', { html: icon('refresh') + 'Reset draft' }), h('p', {}, 'Buang semua perubahan yang belum dipublikasikan dan muat ulang versi terbaru.'))),
      h('button', {
        type: 'button', class: 'btn btn-danger-ghost btn-sm', html: icon('refresh') + ' Reset ke versi tayang', onclick: async () => {
          const ok = await dialog({ title: 'Reset draft?', message: 'Semua perubahan yang belum dipublikasikan akan hilang.', icon: 'refresh', tone: 'danger', actions: [{ label: 'Batal', value: false }, { label: 'Reset', danger: true, value: true }] });
          if (!ok) return;
          store.remove(PF.DRAFT_KEY);
          await files.clear();
          try { await load(); } catch (e) { toast(e.message, 'err'); }
          applyAccent(); updateStatus(); render();
          toast('Draft direset');
        }
      })));
    return wrap;
  }

  /* =========================================================
     Router & render
     ========================================================= */
  function renderSidebar() {
    const nav = $('#sbNav');
    nav.innerHTML = '';
    let group = '';
    SECTIONS.forEach((s) => {
      if (s.group !== group) { group = s.group; nav.append(h('div', { class: 'sb-group' }, group)); }
      nav.append(h('button', {
        type: 'button', class: 'sb-item' + (state.section === s.id ? ' active' : ''), 'data-sec': s.id,
        html: icon(s.icon) + `<span>${esc(s.label)}</span>` + (s.list ? `<span class="count">${(state.data[s.id] || []).length}</span>` : ''),
        onclick: () => go(s.id)
      }));
    });
  }

  function render({ keepScroll = false } = {}) {
    const y = window.scrollY;
    const content = $('#content');
    const sec = SECTIONS.find((s) => s.id === state.section) || SECTIONS[0];
    $('#tbTitle').textContent = sec.label;
    document.title = sec.label + ' · Admin Portfolio';
    let page;
    switch (sec.id) {
      case 'profile': page = h('div', {}, pageHead('Profil', 'Informasi utama yang tampil di bagian paling atas situs.'), formPanel('Data profil', 'user', PROFILE_FIELDS, state.data.profile)); break;
      case 'about': page = h('div', {}, pageHead('Tentang saya', 'Cerita singkat, minat, dan hal yang sedang kamu pelajari.'), formPanel('Isi bagian Tentang', 'book', ABOUT_FIELDS, state.data), listPanel('services'), listPanel('stats')); break;
      case 'skills': page = pageList('skills', 'Skill', 'Bahasa pemrograman, framework, dan tools. Ikon terdeteksi otomatis dari nama.'); break;
      case 'projects': page = pageList('projects', 'Proyek', 'Karya yang pernah kamu kerjakan: tugas kuliah, proyek pribadi, lomba, atau freelance.'); break;
      case 'certificates': page = pageList('certificates', 'Sertifikat', 'Sertifikat kursus, pelatihan, seminar, dan kompetisi.'); break;
      case 'experience': page = pageList('experience', 'Pengalaman', 'Magang, kerja, organisasi, dan kepanitiaan.'); break;
      case 'education': page = pageList('education', 'Pendidikan', 'Riwayat pendidikan formal.'); break;
      case 'socials': page = pageList('socials', 'Media sosial', 'Tautan profil kamu di platform lain.'); break;
      case 'settings': page = pageSettings(); break;
      case 'github': page = pageGithub(); break;
      case 'backup': page = pageBackup(); break;
      default: page = pageDashboard();
    }
    content.innerHTML = '';
    content.append(page);
    renderSidebar();
    if (keepScroll) window.scrollTo(0, y);
  }

  function go(id) {
    if (!SECTIONS.some((s) => s.id === id)) id = 'dashboard';
    closeDrawer();
    state.section = id;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    render();
    window.scrollTo(0, 0);
    toggleSidebar(false);
  }

  function toggleSidebar(open) {
    $('#sidebar').classList.toggle('open', open);
    $('#sbOverlay').classList.toggle('open', open);
  }

  /* =========================================================
     Boot
     ========================================================= */
  function bind() {
    $('#sbToggle').addEventListener('click', () => toggleSidebar(!$('#sidebar').classList.contains('open')));
    $('#sbOverlay').addEventListener('click', () => toggleSidebar(false));
    $('#btnPreview').addEventListener('click', preview);
    $('#btnPublish').addEventListener('click', publish);
    $('#drawer').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dialogOpen) { closeDrawer(); toggleSidebar(false); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveDraft(); toast(isDirty() ? 'Draft tersimpan di browser' : 'Tidak ada perubahan'); }
    });
    window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== state.section) go(id); });
    window.addEventListener('beforeunload', saveDraft);
  }

  async function boot() {
    bind();
    renderGhPill();
    try {
      await load();
    } catch (e) {
      console.error(e);
      $('#content').innerHTML = '';
      $('#content').append(h('div', { class: 'panel' },
        h('h2', {}, 'Gagal memuat data'),
        h('p', { class: 'muted', style: 'margin:8px 0 16px' }, e.message + '. Pastikan halaman dibuka lewat server (bukan file://).'),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => location.reload() }, 'Coba lagi')));
      return;
    }
    const hash = location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === hash)) state.section = hash;
    applyAccent();
    render();
    updateStatus();
    renderGhPill();
  }

  boot();
})();
