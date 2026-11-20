/* =========================================================
   main.js — render & interaksi situs portfolio
   ========================================================= */
(function () {
  'use strict';

  const { esc, icon, asset, techIcon, knownIcon, fmtMonth, fmtDate, relTime, hue, SOCIALS, socialHref, waLink, levelLabel } = PF;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const PREVIEW = new URLSearchParams(location.search).has('preview');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COVER_HUES = [252, 265, 280, 222, 196, 172, 318, 238];
  let DATA = null;
  let revealObserver = null;

  init();

  async function init() {
    setupNav();
    setupScrollFx();
    setupCursor();
    setupModal();
    setupCmdk();
    try {
      DATA = normalize(await PF.loadData({ preview: PREVIEW }));
    } catch (e) {
      console.error(e);
      toast('Gagal memuat data portfolio. Coba muat ulang halaman.', 'alert');
      observeReveal();
      return;
    }
    if (PREVIEW) $('#previewBar').hidden = false;

    applySettings();
    renderHero();
    renderMarquee();
    renderAbout();
    renderSkills();
    renderProjects();
    renderCerts();
    renderJourney();
    renderContact();
    renderFooter();
    renderGithub();
    buildCmdkItems();
    observeReveal();
    requestAnimationFrame(updateIndicator);
    openFromHash();
  }

  function normalize(d) {
    d = d || {};
    const arr = (k) => (Array.isArray(d[k]) ? d[k] : []);
    return {
      meta: d.meta || {},
      settings: d.settings || {},
      profile: d.profile || {},
      about: d.about || {},
      softSkills: arr('softSkills').filter(Boolean),
      services: arr('services'),
      stats: arr('stats').filter((s) => s && s.label),
      skills: arr('skills').filter((s) => s && s.name),
      projects: arr('projects').filter((p) => p && p.title && !p.hidden).map((p, i) => ({ ...p, id: p.id || PF.slug(p.title) || 'p' + i })),
      certificates: arr('certificates').filter((c) => c && c.title && !c.hidden),
      experience: arr('experience').filter((x) => x && !x.hidden),
      education: arr('education').filter((x) => x && !x.hidden),
      socials: arr('socials').filter((s) => s && s.url)
    };
  }

  /* =========================================================
     Settings & helpers
     ========================================================= */
  function applySettings() {
    const s = DATA.settings;
    const root = document.documentElement.style;
    const hex = /^#[0-9a-f]{3,8}$/i;
    if (hex.test(s.accent || '')) root.setProperty('--accent', s.accent);
    if (hex.test(s.accent2 || '')) root.setProperty('--accent-2', s.accent2);
    const name = DATA.profile.name;
    if (name) document.title = name + ' — Portfolio';
  }

  function allSocials() {
    const list = DATA.socials.slice();
    const p = DATA.profile;
    if (p.email && !list.some((s) => s.platform === 'email')) list.push({ platform: 'email', url: p.email, label: 'Email' });
    if (p.whatsapp && !list.some((s) => s.platform === 'whatsapp')) list.push({ platform: 'whatsapp', url: p.whatsapp, label: 'WhatsApp' });
    return list;
  }
  function socialsHtml(list) {
    return list.map((s) => {
      const meta = SOCIALS[s.platform] || SOCIALS.other;
      const label = s.label || meta.label;
      const href = socialHref(s);
      const ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
      return `<a class="icon-btn" href="${esc(href)}"${ext} aria-label="${esc(label)}" title="${esc(label)}">${icon(meta.icon)}</a>`;
    }).join('');
  }
  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
      .map((t) => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');
  }
  function catIcon(cat) {
    const c = String(cat || '').toLowerCase();
    if (/mobile|android|ios|flutter/.test(c)) return 'smartphone';
    if (/ai|machine|data|ml|vision/.test(c)) return 'cpu';
    if (/design|ui|ux/.test(c)) return 'pen-tool';
    if (/game/.test(c)) return 'play';
    if (/program|cli|script|desktop/.test(c)) return 'code';
    if (/web|site/.test(c)) return 'monitor';
    return 'folder';
  }
  function coverHue(str) { return COVER_HUES[hue(str) % COVER_HUES.length]; }
  function isPdf(path) { return /\.pdf($|\?)/i.test(path || '') || /^data:application\/pdf/i.test(asset(path) || ''); }
  function copy(text, msg = 'Disalin ke clipboard') {
    const done = () => toast(msg);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    ta.remove();
  }
  let toastTimer;
  function toast(msg, ic = 'check') {
    const el = $('#toast');
    el.innerHTML = icon(ic) + '<span>' + esc(msg) + '</span>';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  let scrollLocks = 0;
  function lockScroll(on) {
    scrollLocks = Math.max(0, scrollLocks + (on ? 1 : -1));
    document.documentElement.style.overflow = scrollLocks ? 'hidden' : '';
  }

  /* =========================================================
     Hero
     ========================================================= */
  function renderHero() {
    const p = DATA.profile;
    const status = $('#heroStatus');
    status.classList.toggle('off', p.available === false);
    $('.status-text', status).textContent = p.status || (p.available === false ? 'Sedang fokus kuliah' : 'Terbuka untuk kolaborasi');
    if (!p.status && p.available == null) status.hidden = true;

    $('#heroGreeting').innerHTML = `${esc(p.greeting || 'Halo, saya')} <span class="wave">👋</span>`;
    const words = String(p.name || '').trim().split(/\s+/);
    const last = words.length > 1 ? words.pop() : '';
    $('#heroName').innerHTML = `${esc(words.join(' '))}${last ? ' <span class="grad">' + esc(last) + '</span>' : ''}`;
    $('#heroTagline').textContent = p.tagline || '';

    const roles = (p.roles || []).filter(Boolean);
    typeLoop($('#typed'), roles.length ? roles : ['Mahasiswa Teknik Informatika']);

    const cv = $('#heroCv');
    if (p.cv) {
      cv.href = asset(p.cv);
      cv.target = '_blank';
      cv.rel = 'noopener';
      cv.innerHTML = 'Unduh CV ' + icon('download');
    }

    const meta = [];
    if (p.location) meta.push(`<span class="meta-item">${icon('map-pin')} ${esc(p.location)}</span>`);
    if (p.university) meta.push(`<span class="meta-item">${icon('graduation')} ${esc(p.university)}</span>`);
    const socials = allSocials();
    $('#heroMeta').innerHTML = meta.join('') + (socials.length ? `<div class="socials">${socialsHtml(socials)}</div>` : '');
    $('#mobileSocials').innerHTML = socialsHtml(socials);

    const img = $('#heroPhoto');
    img.alt = 'Foto ' + (p.name || 'profil');
    img.onerror = () => {
      img.replaceWith(Object.assign(document.createElement('div'), { className: 'mono-fallback', textContent: (p.name || 'S').charAt(0) }));
    };
    if (p.avatar) img.src = asset(p.avatar);

    const major = String(p.major || '').replace(/^S\d\s*/i, '').trim();
    $('#fb1').innerHTML = major || p.university
      ? `<span class="fb-ic">${icon('graduation')}</span><span><strong>${esc(major || 'Mahasiswa')}</strong><small>${esc(p.university || '')}</small></span>`
      : '';
    const n = DATA.projects.length;
    $('#fb2').innerHTML = n
      ? `<span class="fb-ic">${icon('code')}</span><span><strong>${n}+ Proyek</strong><small>${DATA.skills.length} teknologi</small></span>`
      : '';
  }

  function typeLoop(el, words) {
    el.textContent = words[0];
    if (reduceMotion || words.length < 2) return;
    let w = 0, i = words[0].length, deleting = true;
    const tick = () => {
      if (deleting) {
        i--;
        el.textContent = words[w].slice(0, i);
        if (i <= 0) { deleting = false; w = (w + 1) % words.length; setTimeout(tick, 300); return; }
        setTimeout(tick, 32);
      } else {
        i++;
        el.textContent = words[w].slice(0, i);
        if (i >= words[w].length) { deleting = true; setTimeout(tick, 2200); return; }
        setTimeout(tick, 62);
      }
    };
    setTimeout(tick, 2400);
  }

  function renderMarquee() {
    const skills = DATA.skills;
    const track = $('#marquee');
    if (!skills.length) { track.parentElement.remove(); return; }
    let items = skills.slice();
    while (items.length < 14) items = items.concat(skills);
    const html = items.map((s) => `<span class="marquee-item">${techIcon(s.name, s.icon)}${esc(s.name)}</span>`).join('');
    track.innerHTML = html + html.replace(/class="marquee-item"/g, 'class="marquee-item" aria-hidden="true"');
  }

  /* =========================================================
     About (bento)
     ========================================================= */
  function renderAbout() {
    const p = DATA.profile, a = DATA.about, s = DATA.settings;
    const paras = (a.paragraphs || []).filter(Boolean);
    const learning = (a.learning || []).filter(Boolean);
    const interests = (a.interests || []).filter(Boolean);
    const github = DATA.socials.find((x) => x.platform === 'github');

    const stats = [
      ...DATA.stats.map((x) => ({ value: x.value, label: x.label })),
      { value: DATA.projects.length, label: 'Proyek dikerjakan', plus: true },
      { value: DATA.skills.length, label: 'Teknologi digunakan', plus: true },
      { value: DATA.certificates.length, label: 'Sertifikat' }
    ];
    if (s.githubUsername && s.showGithub !== false) stats.push({ value: '—', label: 'Repositori GitHub', id: 'statRepos', plus: true });

    const statHtml = stats.map((x) => {
      const num = Number(x.value);
      const isNum = x.value !== '' && !isNaN(num) && String(x.value).trim() !== '';
      return `<div class="stat"><div class="stat-num"${x.id ? ` id="${x.id}"` : ''}${isNum ? ` data-count="${num}"` : ''}>${isNum ? '0' : esc(x.value)}${x.plus ? '<span class="plus">+</span>' : ''}</div><div class="stat-label">${esc(x.label)}</div></div>`;
    }).join('');

    const services = DATA.services.filter((x) => x && x.title).map((x, i) => `
      <article class="card spot b-service reveal" style="--d:${(i * 0.07).toFixed(2)}s">
        <div class="service-ic">${icon(x.icon || 'sparkles')}</div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(x.description || '')}</p>
      </article>`).join('');

    $('#aboutBento').innerHTML = `
      <article class="card spot b-bio reveal">
        <div class="card-label">${icon('user')} Profil Singkat</div>
        <div class="bio-text">${paras.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
        <div class="bio-foot">
          <a href="#projects" class="btn btn-ghost btn-sm">Lihat proyek ${icon('arrow-right')}</a>
          ${p.cv ? `<a href="${esc(asset(p.cv))}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Unduh CV ${icon('download')}</a>` : ''}
          ${github ? `<a href="${esc(socialHref(github))}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">${icon('github')} GitHub</a>` : ''}
        </div>
      </article>
      <article class="card spot b-edu reveal" style="--d:.06s">
        <div class="edu-logo">${icon('graduation')}</div>
        <div class="card-label" style="margin-bottom:8px">Pendidikan</div>
        <h3>${esc(p.university || '-')}</h3>
        <p>${esc(p.major || '')}${p.semester ? ' · Semester ' + esc(p.semester) : ''}</p>
      </article>
      <article class="card spot b-clock reveal" style="--d:.12s">
        <div class="card-label">${icon('clock')} Waktu Lokal Saya</div>
        <div class="clock-time" id="clock">--:--</div>
        <div class="clock-sub">${icon('map-pin')} ${esc(p.location || 'Indonesia')} · ${esc(s.timezoneLabel || 'WIB')}</div>
        <div class="clock-sub" id="clockNote"></div>
      </article>
      <div class="card b-stats reveal">${statHtml}</div>
      ${services}
      ${learning.length ? `
      <article class="card spot b-half reveal">
        <div class="card-label">${icon('zap')} Sedang Dipelajari</div>
        <div class="chip-list">${learning.map((t) => `<span class="chip accent"><span class="pulse"></span>${esc(t)}</span>`).join('')}</div>
      </article>` : ''}
      ${interests.length ? `
      <article class="card spot b-half reveal" style="--d:.06s">
        <div class="card-label">${icon('heart')} Minat</div>
        <div class="chip-list">${interests.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      </article>` : ''}
    `;
    // jika hanya satu kartu "half", lebarkan penuh
    const halves = $$('.b-half', $('#aboutBento'));
    if (halves.length === 1) halves[0].style.gridColumn = '1 / -1';
    startClock(s.timezone || 'Asia/Jakarta');
  }

  function startClock(tz) {
    const el = $('#clock'), note = $('#clockNote');
    let fmt;
    try { fmt = new Intl.DateTimeFormat('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    catch (e) { fmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    const update = () => {
      const parts = fmt.formatToParts(new Date());
      const get = (t) => (parts.find((x) => x.type === t) || {}).value || '00';
      const h = parseInt(get('hour'), 10) % 24;
      el.innerHTML = `${get('hour')}:${get('minute')}<span class="sec">:${get('second')}</span>`;
      let msg;
      if (h < 5) msg = '🌙 Kemungkinan sedang istirahat';
      else if (h < 11) msg = '☀️ Selamat pagi, waktunya produktif';
      else if (h < 15) msg = '💻 Siang hari, sedang kuliah / ngoding';
      else if (h < 19) msg = '🌇 Sore hari, masih online';
      else msg = '🌃 Malam hari, waktunya side project';
      if (note.textContent !== msg) note.textContent = msg;
    };
    update();
    setInterval(update, 1000);
  }

  /* =========================================================
     Skills
     ========================================================= */
  function renderSkills() {
    const skills = DATA.skills;
    const sec = $('#skills');
    if (!skills.length) { sec.remove(); return; }
    const cats = [...new Set(skills.map((s) => s.category || 'Lainnya'))];
    const tabs = $('#skillTabs');
    tabs.innerHTML = [`<button class="tab active" role="tab" aria-selected="true" data-cat="*">Semua <span class="count">${skills.length}</span></button>`]
      .concat(cats.map((c) => `<button class="tab" role="tab" aria-selected="false" data-cat="${esc(c)}">${esc(c)} <span class="count">${skills.filter((s) => (s.category || 'Lainnya') === c).length}</span></button>`))
      .join('');
    if (cats.length < 2) tabs.hidden = true;

    $('#skillsGrid').innerHTML = skills.map((s, i) => {
      const lvl = Math.max(0, Math.min(100, Number(s.level) || 0));
      return `
      <div class="card spot skill reveal" data-cat="${esc(s.category || 'Lainnya')}" style="--d:${((i % 6) * 0.04).toFixed(2)}s">
        <div class="skill-top">
          <span class="skill-ic">${techIcon(s.name, s.icon)}</span>
          <div><div class="skill-name">${esc(s.name)}</div><div class="skill-lvl">${levelLabel(lvl)} · ${lvl}%</div></div>
        </div>
        <div class="bar" role="progressbar" aria-valuenow="${lvl}" aria-valuemin="0" aria-valuemax="100" aria-label="Tingkat ${esc(s.name)}"><span style="--w:${lvl}%"></span></div>
      </div>`;
    }).join('');

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      $$('.tab', tabs).forEach((t) => { t.classList.toggle('active', t === btn); t.setAttribute('aria-selected', t === btn); });
      const cat = btn.dataset.cat;
      $$('.skill', $('#skillsGrid')).forEach((el) => {
        const show = cat === '*' || el.dataset.cat === cat;
        el.classList.toggle('hide', !show);
        if (show) { el.classList.remove('anim'); void el.offsetWidth; el.classList.add('anim'); }
      });
    });

    const soft = DATA.softSkills;
    $('#softSkills').innerHTML = soft.length
      ? `<span class="label">Soft skills</span>${soft.map((t) => `<span class="chip">${icon('check')}${esc(t)}</span>`).join('')}`
      : '';
  }

  /* =========================================================
     Projects
     ========================================================= */
  const projState = { cat: '*', q: '' };

  function cover(p, extra = '') {
    const badges = p.featured ? `<div class="p-badges"><span class="badge star">${icon('star')} Unggulan</span></div>` : '';
    if (p.image) {
      return `<div class="cover ${extra}">${badges}<img class="shot" src="${esc(asset(p.image))}" alt="Tampilan ${esc(p.title)}" loading="lazy"></div>`;
    }
    const stack = (p.tags || []).filter(knownIcon).slice(0, 4).map((t) => techIcon(t)).join('');
    return `<div class="cover gen ${extra}" style="--h:${coverHue(p.title)}">${badges}
      <div class="gen-inner">
        <span class="gen-ic">${icon(catIcon(p.category))}</span>
        <span class="gen-title">${esc(p.title)}</span>
        <div class="gen-stack">${stack}</div>
      </div></div>`;
  }

  function renderProjects() {
    const list = DATA.projects;
    const cats = [...new Set(list.map((p) => p.category).filter(Boolean))];
    const filters = $('#projectFilters');
    filters.innerHTML = [`<button class="tab active" data-cat="*" role="tab" aria-selected="true">Semua <span class="count">${list.length}</span></button>`]
      .concat(cats.map((c) => `<button class="tab" data-cat="${esc(c)}" role="tab" aria-selected="false">${esc(c)} <span class="count">${list.filter((p) => p.category === c).length}</span></button>`))
      .join('');
    if (cats.length < 2) filters.hidden = true;
    if (list.length < 5) $('#projectSearch').closest('.search-box').hidden = true;

    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      $$('.tab', filters).forEach((t) => { t.classList.toggle('active', t === btn); t.setAttribute('aria-selected', t === btn); });
      projState.cat = btn.dataset.cat;
      drawProjects();
    });
    let t;
    $('#projectSearch').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { projState.q = e.target.value.trim().toLowerCase(); drawProjects(); }, 150);
    });

    const grid = $('#projectsGrid');
    grid.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const card = e.target.closest('.project');
      if (card) openProject(card.dataset.id);
    });
    grid.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('project')) {
        e.preventDefault();
        openProject(e.target.dataset.id);
      }
    });
    drawProjects();
  }

  function drawProjects() {
    const { cat, q } = projState;
    const list = DATA.projects.filter((p) => {
      if (cat !== '*' && p.category !== cat) return false;
      if (!q) return true;
      const hay = [p.title, p.description, p.category, ...(p.tags || [])].join(' ').toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    const grid = $('#projectsGrid');
    if (!list.length) {
      grid.innerHTML = DATA.projects.length
        ? `<div class="empty"><div class="empty-ic">${icon('search')}</div><h3>Tidak ada proyek yang cocok</h3><p>Coba kata kunci lain atau pilih kategori “Semua”.</p></div>`
        : `<div class="empty"><div class="empty-ic">${icon('folder')}</div><h3>Proyek segera hadir</h3><p>Proyek-proyek terbaru akan ditampilkan di sini.</p></div>`;
      return;
    }
    grid.innerHTML = list.map((p, i) => `
      <article class="card spot project${p.featured ? ' featured' : ''} reveal" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="Lihat detail ${esc(p.title)}" style="--d:${((i % 3) * 0.07).toFixed(2)}s">
        ${cover(p)}
        <div class="p-body">
          <div class="p-meta">${p.category ? `<span>${esc(p.category)}</span>` : ''}${p.category && p.date ? '<span class="sep"></span>' : ''}${p.date ? `<span>${esc(fmtMonth(p.date))}</span>` : ''}</div>
          <h3 class="p-title">${esc(p.title)}</h3>
          <p class="p-desc">${esc(p.description || '')}</p>
          <div class="tags">${(p.tags || []).slice(0, 5).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${(p.tags || []).length > 5 ? `<span class="tag">+${p.tags.length - 5}</span>` : ''}</div>
          <div class="p-foot">
            <span class="p-more">Lihat detail ${icon('arrow-right')}</span>
            <div class="p-links">
              ${p.repo ? `<a class="icon-btn" href="${esc(p.repo)}" target="_blank" rel="noopener" aria-label="Source code ${esc(p.title)}" title="Source code">${icon('github')}</a>` : ''}
              ${p.demo ? `<a class="icon-btn" href="${esc(p.demo)}" target="_blank" rel="noopener" aria-label="Demo ${esc(p.title)}" title="Lihat demo">${icon('external')}</a>` : ''}
            </div>
          </div>
        </div>
      </article>`).join('');
    observeReveal();
  }

  function openProject(id) {
    const p = DATA.projects.find((x) => x.id === id);
    if (!p) return;
    const features = (p.features || []).filter(Boolean);
    const gallery = (p.gallery || []).filter(Boolean);
    const tags = p.tags || [];
    const html = `
      ${cover(p, 'm-cover')}
      <div class="m-content">
        <div class="m-meta">
          ${p.category ? `<span class="chip accent">${icon(catIcon(p.category))}${esc(p.category)}</span>` : ''}
          ${p.date ? `<span class="chip">${icon('calendar')}${esc(fmtMonth(p.date, true))}</span>` : ''}
        </div>
        <h3 class="m-title" id="modalTitle">${esc(p.title)}</h3>
        <div class="m-desc">${paragraphs(p.longDescription || p.description)}</div>
        ${features.length ? `<div class="m-section"><h4>Fitur utama</h4><ul class="m-features">${features.map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul></div>` : ''}
        ${gallery.length ? `<div class="m-section"><h4>Galeri</h4><div class="m-gallery">${gallery.map((g) => `<img src="${esc(asset(g))}" alt="Galeri ${esc(p.title)}" loading="lazy" data-zoom>`).join('')}</div></div>` : ''}
        ${tags.length ? `<div class="m-section"><h4>Teknologi</h4><div class="m-stack">${tags.map((t) => `<span class="st">${knownIcon(t) ? techIcon(t) : `<span class="ti ti-mono">${esc(t.charAt(0).toUpperCase())}</span>`}${esc(t)}</span>`).join('')}</div></div>` : ''}
        <div class="m-links">
          ${p.demo ? `<a class="btn btn-primary" href="${esc(p.demo)}" target="_blank" rel="noopener">Lihat Demo ${icon('external')}</a>` : ''}
          ${p.repo ? `<a class="btn btn-ghost" href="${esc(p.repo)}" target="_blank" rel="noopener">${icon('github')} Source Code</a>` : ''}
          ${p.video ? `<a class="btn btn-ghost" href="${esc(p.video)}" target="_blank" rel="noopener">${icon('play')} Tonton Video</a>` : ''}
        </div>
      </div>`;
    openModal(html);
    try { history.replaceState(null, '', '#proyek/' + encodeURIComponent(p.id)); } catch (e) { /* ignore */ }
  }

  function openFromHash() {
    const m = location.hash.match(/^#proyek\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      document.getElementById('projects').scrollIntoView();
      setTimeout(() => openProject(id), 300);
    }
  }

  /* =========================================================
     Certificates
     ========================================================= */
  const certState = { cat: '*' };
  function renderCerts() {
    const list = DATA.certificates;
    const filters = $('#certFilters');
    const cats = [...new Set(list.map((c) => c.category).filter(Boolean))];
    if (cats.length >= 2) {
      filters.innerHTML = [`<button class="tab active" data-cat="*">Semua <span class="count">${list.length}</span></button>`]
        .concat(cats.map((c) => `<button class="tab" data-cat="${esc(c)}">${esc(c)} <span class="count">${list.filter((x) => x.category === c).length}</span></button>`)).join('');
      filters.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (!btn) return;
        $$('.tab', filters).forEach((t) => t.classList.toggle('active', t === btn));
        certState.cat = btn.dataset.cat;
        drawCerts();
      });
    } else {
      $('#certToolbar').hidden = true;
    }
    $('#certsGrid').addEventListener('click', (e) => {
      const v = e.target.closest('[data-view]');
      if (v) { e.preventDefault(); viewCert(Number(v.dataset.view)); }
    });
    drawCerts();
  }

  function drawCerts() {
    const all = DATA.certificates;
    const grid = $('#certsGrid');
    if (!all.length) {
      grid.innerHTML = `<div class="empty reveal"><div class="empty-ic">${icon('award')}</div><h3>Segera hadir</h3><p>Sertifikat pelatihan, kursus, dan kompetisi sedang saya kumpulkan dan akan ditampilkan di sini.</p></div>`;
      observeReveal();
      return;
    }
    const list = all.map((c, i) => ({ c, i })).filter(({ c }) => certState.cat === '*' || c.category === certState.cat);
    grid.innerHTML = list.map(({ c, i }, n) => {
      const file = c.image || c.file;
      const hasImg = file && !isPdf(file);
      const thumb = hasImg
        ? `<img src="${esc(asset(file))}" alt="Sertifikat ${esc(c.title)}" loading="lazy">`
        : `<div class="cert-gen gen" style="--h:${coverHue(c.issuer || c.title)}"><span class="medal">${icon('award')}</span><span>${esc(c.issuer || 'Sertifikat')}</span></div>`;
      const canView = !!file;
      return `
      <article class="card spot cert reveal" style="--d:${((n % 3) * 0.07).toFixed(2)}s">
        <div class="cert-thumb"${canView ? ` data-view="${i}" role="button" tabindex="0" aria-label="Lihat sertifikat ${esc(c.title)}"` : ''}>
          ${thumb}${canView ? `<div class="zoom">${icon('eye')}&nbsp; ${isPdf(file) ? 'Buka PDF' : 'Perbesar'}</div>` : ''}
        </div>
        <div class="cert-body">
          ${c.issuer ? `<div class="cert-issuer">${icon('award')} ${esc(c.issuer)}</div>` : ''}
          <h3 class="cert-title">${esc(c.title)}</h3>
          <div class="cert-meta">
            ${c.date ? `<span>${icon('calendar')} ${esc(fmtMonth(c.date, true))}</span>` : ''}
            ${c.credentialId ? `<span>${icon('key')} ${esc(c.credentialId)}</span>` : ''}
          </div>
          ${c.description ? `<p class="p-desc">${esc(c.description)}</p>` : ''}
          <div class="cert-foot">
            ${canView ? `<button class="btn btn-ghost" data-view="${i}" type="button">${icon('eye')} Lihat</button>` : ''}
            ${c.url ? `<a class="btn btn-ghost" href="${esc(c.url)}" target="_blank" rel="noopener">${icon('shield')} Verifikasi</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
    observeReveal();
  }

  function viewCert(i) {
    const c = DATA.certificates[i];
    if (!c) return;
    const file = c.image || c.file;
    if (!file) { if (c.url) window.open(c.url, '_blank', 'noopener'); return; }
    if (isPdf(file)) {
      const src = asset(file);
      if (/^data:/.test(src)) {
        fetch(src).then((r) => r.blob()).then((b) => window.open(URL.createObjectURL(b), '_blank'));
      } else window.open(src, '_blank', 'noopener');
      return;
    }
    openModal(`<img src="${esc(asset(file))}" alt="Sertifikat ${esc(c.title)}">`, { image: true });
  }

  /* =========================================================
     Journey
     ========================================================= */
  function period(start, end, ongoingLabel = 'Sekarang') {
    if (!start && !end) return 'Sedang berjalan';
    return `${start ? fmtMonth(start) : '…'} — ${end ? fmtMonth(end) : ongoingLabel}`;
  }
  function points(list) {
    const l = (list || []).filter(Boolean);
    return l.length ? `<ul class="t-points">${l.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  }
  function renderJourney() {
    const edu = DATA.education, exp = DATA.experience;
    const eduHtml = edu.map((e) => `
      <div class="card spot t-item">
        <div class="t-period">${icon('calendar')} ${esc(period(e.start, e.end))}${e.gpa ? `<span class="t-type">IPK ${esc(e.gpa)}</span>` : ''}</div>
        <h4 class="t-title">${esc(e.school)}</h4>
        <div class="t-org">${esc([e.degree, e.major].filter(Boolean).join(' — '))}</div>
        ${e.description ? `<p class="t-desc">${esc(e.description)}</p>` : ''}
        ${points(e.points)}
      </div>`).join('');
    const expHtml = exp.map((x) => `
      <div class="card spot t-item">
        <div class="t-period">${icon('calendar')} ${esc(period(x.start, x.end))}${x.type ? `<span class="t-type">${esc(x.type)}</span>` : ''}</div>
        <h4 class="t-title">${esc(x.role)}</h4>
        <div class="t-org">${esc([x.organization, x.location].filter(Boolean).join(' · '))}</div>
        ${x.description ? `<p class="t-desc">${esc(x.description)}</p>` : ''}
        ${points(x.points)}
      </div>`).join('');
    const cta = `
      <div class="card t-cta">
        <h4>Siap untuk pengalaman berikutnya 🚀</h4>
        <p>Saya terbuka untuk kesempatan magang, proyek freelance, kepanitiaan, maupun kolaborasi riset. Mari bangun sesuatu bersama!</p>
        <a href="#contact" class="btn btn-primary btn-sm">Ajak berkolaborasi ${icon('arrow-right')}</a>
      </div>`;
    $('#journey-wrap').innerHTML = `
      <div class="j-col reveal">
        <h3>${icon('graduation')} Pendidikan</h3>
        ${edu.length ? `<div class="timeline">${eduHtml}</div>` : cta}
      </div>
      <div class="j-col reveal" style="--d:.08s">
        <h3>${icon('briefcase')} Pengalaman &amp; Organisasi</h3>
        ${exp.length ? `<div class="timeline">${expHtml}</div>${''}` : cta}
      </div>`;
  }

  /* =========================================================
     GitHub
     ========================================================= */
  const LANG_COLORS = {
    'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'PHP': '#7a86b8', 'Python': '#3572A5', 'Java': '#b07219',
    'HTML': '#e34c26', 'CSS': '#663399', 'Jupyter Notebook': '#DA5B0B', 'Kotlin': '#A97BFF', 'Dart': '#00B4AB',
    'Vue': '#41b883', 'C++': '#f34b7d', 'C': '#8d8d8d', 'C#': '#178600', 'Go': '#00ADD8', 'Shell': '#89e051',
    'Blade': '#f7523f', 'Swift': '#F05138', 'Rust': '#dea584', 'SCSS': '#c6538c', 'Svelte': '#ff3e00'
  };
  async function ghFetch(url, ttl = 30 * 60 * 1000) {
    const key = 'pf:gh-cache:' + url;
    try {
      const c = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < ttl) return c.d;
    } catch (e) { /* ignore */ }
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub ' + res.status);
    const d = await res.json();
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* ignore */ }
    return d;
  }

  async function renderGithub() {
    const s = DATA.settings;
    const sec = $('#github');
    const user = (s.githubUsername || '').trim();
    if (!user || s.showGithub === false) {
      sec.remove();
      $$('a[href="#github"]').forEach((a) => a.remove());
      return;
    }
    const wrap = $('#githubWrap');
    wrap.innerHTML = `<div class="gh-top"><div class="skeleton"></div><div class="skeleton"></div></div><div class="gh-repos"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;

    let u, repos;
    try {
      [u, repos] = await Promise.all([
        ghFetch(`https://api.github.com/users/${encodeURIComponent(user)}`),
        ghFetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`)
      ]);
    } catch (e) {
      wrap.innerHTML = `<div class="empty"><div class="empty-ic">${icon('github')}</div><h3>@${esc(user)}</h3><p>Statistik GitHub sedang tidak dapat dimuat. Kunjungi profil saya langsung di GitHub.</p><br><a class="btn btn-ghost btn-sm" href="https://github.com/${esc(user)}" target="_blank" rel="noopener">Buka GitHub ${icon('external')}</a></div>`;
      return;
    }
    const own = repos.filter((r) => !r.fork);
    const langCount = {};
    own.forEach((r) => { if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1; });
    const langs = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
    const totalLang = langs.reduce((n, [, c]) => n + c, 0) || 1;
    const top = langs.slice(0, 6);
    const other = langs.slice(6).reduce((n, [, c]) => n + c, 0);
    if (other) top.push(['Lainnya', other]);
    const color = (l) => LANG_COLORS[l] || '#6b7280';

    const statRepos = $('#statRepos');
    if (statRepos) { statRepos.dataset.count = u.public_repos; if (statRepos.dataset.done) countUp(statRepos); }

    const recent = own.slice().sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).slice(0, 6);

    wrap.innerHTML = `
      <div class="gh-top">
        <div class="card spot gh-profile reveal">
          <div class="gh-user">
            <img src="${esc(u.avatar_url)}&s=120" alt="Avatar GitHub ${esc(u.login)}" loading="lazy" width="58" height="58">
            <div><strong>${esc(u.name || u.login)}</strong><span>@${esc(u.login)}</span></div>
          </div>
          <div class="gh-stats">
            <div class="gh-stat"><b>${u.public_repos}</b><small>Repositori</small></div>
            <div class="gh-stat"><b>${langs.length}</b><small>Bahasa</small></div>
            <div class="gh-stat"><b>${u.followers}</b><small>Followers</small></div>
          </div>
          ${top.length ? `<div>
            <div class="card-label" style="margin-bottom:12px">${icon('code')} Bahasa paling sering dipakai</div>
            <div class="lang-bar">${top.map(([l, c]) => `<span style="width:${(c / totalLang * 100).toFixed(1)}%;background:${color(l)}" title="${esc(l)}"></span>`).join('')}</div>
            <div class="lang-legend">${top.map(([l, c]) => `<span><i class="lang-dot" style="background:${color(l)}"></i>${esc(l)} <b style="color:var(--muted);font-weight:500">${Math.round(c / totalLang * 100)}%</b></span>`).join('')}</div>
          </div>` : ''}
          <a class="btn btn-ghost btn-sm" href="${esc(u.html_url)}" target="_blank" rel="noopener" style="align-self:flex-start">${icon('github')} Ikuti di GitHub</a>
        </div>
        <div class="card spot gh-contrib reveal" id="ghContrib" style="--d:.08s">
          <div class="gh-contrib-head"><strong>Kontribusi setahun terakhir</strong><span id="ghTotal">Memuat…</span></div>
          <div class="heatmap-scroll"><div class="heatmap skeleton" id="heatmap" style="min-height:105px;min-width:100%"></div></div>
          <div class="heat-legend">Sedikit <i style="background:rgba(255,255,255,.05)"></i><i style="background:color-mix(in srgb,var(--accent) 30%,transparent)"></i><i style="background:color-mix(in srgb,var(--accent) 55%,transparent)"></i><i style="background:color-mix(in srgb,var(--accent) 80%,transparent)"></i><i style="background:var(--accent-2)"></i> Banyak</div>
        </div>
      </div>
      ${recent.length ? `<div class="card-label" style="margin:12px 0 0">${icon('git-branch')} Repositori terbaru</div>
      <div class="gh-repos">${recent.map((r, i) => `
        <a class="card spot repo reveal" href="${esc(r.html_url)}" target="_blank" rel="noopener" style="--d:${((i % 3) * 0.06).toFixed(2)}s">
          <div class="repo-name">${icon('folder')} ${esc(r.name)}</div>
          <p class="repo-desc">${esc(r.description || (r.homepage ? 'Demo: ' + r.homepage.replace(/^https?:\/\//, '') : 'Repositori publik di GitHub.'))}</p>
          <div class="repo-meta">
            ${r.language ? `<span><i class="lang-dot" style="background:${color(r.language)}"></i>${esc(r.language)}</span>` : ''}
            ${r.stargazers_count ? `<span>${icon('star')} ${r.stargazers_count}</span>` : ''}
            <span>${icon('clock')} ${esc(relTime(r.pushed_at))}</span>
          </div>
        </a>`).join('')}</div>` : ''}
      <a class="btn btn-ghost gh-more" href="${esc(u.html_url)}?tab=repositories" target="_blank" rel="noopener">Lihat semua repositori ${icon('arrow-up-right')}</a>
    `;
    observeReveal();
    renderHeatmap(user);
  }

  async function renderHeatmap(user) {
    const box = $('#heatmap'), total = $('#ghTotal');
    try {
      const j = await ghFetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`, 6 * 60 * 60 * 1000);
      const days = j.contributions || [];
      if (!days.length) throw new Error('kosong');
      const sum = (j.total && (j.total.lastYear ?? Object.values(j.total).reduce((a, b) => a + b, 0))) || days.reduce((n, d) => n + d.count, 0);
      const pad = new Date(days[0].date + 'T00:00:00').getDay();
      box.classList.remove('skeleton');
      box.removeAttribute('style');
      box.innerHTML = '<i class="pad"></i>'.repeat(pad) + days.map((d) =>
        `<i data-l="${d.level}" title="${d.count} kontribusi · ${esc(fmtDate(d.date + 'T00:00:00'))}"></i>`).join('');
      total.textContent = `${sum.toLocaleString('id-ID')} kontribusi`;
      const sc = box.parentElement;
      sc.scrollLeft = sc.scrollWidth;
    } catch (e) {
      const card = $('#ghContrib');
      if (card) {
        card.querySelector('.heatmap-scroll').innerHTML = `<img src="https://ghchart.rshah.org/8b7bff/${encodeURIComponent(user)}" alt="Grafik kontribusi GitHub" style="width:100%;min-width:640px;filter:invert(1) hue-rotate(180deg) brightness(.9)" loading="lazy">`;
        total.textContent = '';
        const lg = card.querySelector('.heat-legend'); if (lg) lg.remove();
      }
    }
  }

  /* =========================================================
     Contact & footer
     ========================================================= */
  function renderContact() {
    const p = DATA.profile, s = DATA.settings;
    const items = [];
    if (p.email) {
      items.push(`<div class="c-item"><span class="c-ic">${icon('mail')}</span><div><small>Email</small><strong>${esc(p.email)}</strong></div>
        <button class="icon-btn c-act" type="button" data-copy="${esc(p.email)}" aria-label="Salin email" title="Salin email">${icon('copy')}</button></div>`);
    }
    if (p.whatsapp) {
      items.push(`<a class="c-item" href="${esc(waLink(p.whatsapp, 'Halo ' + (p.nickname || '') + ', saya melihat portfolio kamu.'))}" target="_blank" rel="noopener"><span class="c-ic">${icon('whatsapp')}</span><div><small>WhatsApp</small><strong>${esc(p.whatsapp)}</strong></div><span class="c-act">${icon('arrow-up-right')}</span></a>`);
    }
    if (p.location) {
      items.push(`<div class="c-item"><span class="c-ic">${icon('map-pin')}</span><div><small>Lokasi</small><strong>${esc(p.location)}</strong></div></div>`);
    }
    $('#contactList').innerHTML = items.join('');
    $('#contactSocials').innerHTML = socialsHtml(DATA.socials);
    $('#contactList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-copy]');
      if (b) copy(b.dataset.copy, 'Email disalin ke clipboard');
    });

    const form = $('#contactForm');
    const canSend = s.formEndpoint || p.email || p.whatsapp;
    if (!canSend) {
      form.remove();
      $('.contact-card').style.gridTemplateColumns = '1fr';
      return;
    }
    const note = $('#cfNote');
    if (!s.formEndpoint) {
      note.textContent = p.email ? 'Pesan akan dibuka di aplikasi email kamu.' : 'Pesan akan dikirim lewat WhatsApp.';
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = [['#cfName', (v) => v.length >= 2], ['#cfEmail', (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)], ['#cfMsg', (v) => v.length >= 5]];
      let ok = true;
      fields.forEach(([sel, test]) => {
        const el = $(sel);
        const valid = test(el.value.trim());
        el.parentElement.classList.toggle('invalid', !valid);
        if (!valid && ok) { el.focus(); ok = false; }
      });
      if (!ok) { note.className = 'form-note err'; note.textContent = 'Mohon lengkapi nama, email yang valid, dan pesan.'; return; }
      const name = $('#cfName').value.trim(), email = $('#cfEmail').value.trim(), msg = $('#cfMsg').value.trim();

      if (s.formEndpoint) {
        const btn = $('#cfSubmit');
        btn.disabled = true; btn.style.opacity = '.7';
        note.className = 'form-note'; note.textContent = 'Mengirim…';
        try {
          const res = await fetch(s.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, email, message: msg }) });
          if (!res.ok) throw new Error(res.status);
          form.reset();
          note.className = 'form-note ok'; note.textContent = 'Terima kasih! Pesan kamu sudah terkirim.';
        } catch (err) {
          note.className = 'form-note err'; note.textContent = 'Gagal mengirim pesan. Silakan coba lagi atau hubungi lewat media sosial.';
        } finally { btn.disabled = false; btn.style.opacity = ''; }
        return;
      }
      if (p.email) {
        const subject = encodeURIComponent('Halo dari ' + name);
        const body = encodeURIComponent(msg + '\n\n— ' + name + ' (' + email + ')');
        location.href = `mailto:${p.email}?subject=${subject}&body=${body}`;
      } else {
        window.open(waLink(p.whatsapp, `Halo, saya ${name} (${email}).\n\n${msg}`), '_blank', 'noopener');
      }
      note.className = 'form-note ok'; note.textContent = 'Membuka aplikasi untuk mengirim pesan…';
    });
    $$('input, textarea', form).forEach((el) => el.addEventListener('input', () => el.parentElement.classList.remove('invalid')));
  }

  function renderFooter() {
    const p = DATA.profile;
    $('#footerTagline').textContent = [p.major ? 'Mahasiswa ' + String(p.major).replace(/^S\d\s*/i, '') : '', p.university].filter(Boolean).join(' · ');
    $('#footerSocials').innerHTML = socialsHtml(allSocials());
    $('#copyright').textContent = `© ${new Date().getFullYear()} ${p.name || ''}. Dibuat dengan ❤️ dan banyak kopi.`;
    if (DATA.meta.updatedAt) $('#updatedAt').textContent = 'Terakhir diperbarui ' + fmtDate(DATA.meta.updatedAt);
  }

  /* =========================================================
     Navigation & scroll effects
     ========================================================= */
  function setupNav() {
    const nav = $('#nav'), toggle = $('#navToggle'), menu = $('#mobileMenu');
    const setMenu = (open) => {
      if (menu.classList.contains('open') === open) return;
      menu.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
      menu.setAttribute('aria-hidden', !open);
      lockScroll(open);
    };
    toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', () => { if (innerWidth > 960) setMenu(false); updateIndicator(); });

    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // section aktif
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
      }, { rootMargin: '-45% 0px -50% 0px' });
      const watch = () => $$('main section[id]').forEach((s) => io.observe(s));
      watch();
    }
  }
  let activeSec = '';
  function setActive(id) {
    if (activeSec === id) return;
    activeSec = id;
    $$('#navLinks a').forEach((a) => a.classList.toggle('active', a.dataset.sec === id));
    updateIndicator();
  }
  function updateIndicator() {
    const ind = $('.nav-indicator');
    const a = $('#navLinks a.active');
    if (!ind) return;
    if (!a || !a.offsetWidth) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    ind.style.width = a.offsetWidth + 'px';
    ind.style.transform = `translateX(${a.offsetLeft}px)`;
  }

  function setupScrollFx() {
    const bar = $('.scroll-progress span'), toTop = $('#toTop');
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      toTop.classList.toggle('show', scrollY > innerHeight * 0.8);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  }

  function setupCursor() {
    const glow = $('.cursor-glow');
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || reduceMotion) return;
    let x = -1000, y = -1000, raf = 0;
    document.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      document.body.classList.add('has-cursor');
      if (!raf) raf = requestAnimationFrame(() => { glow.style.transform = `translate3d(${x}px, ${y}px, 0)`; raf = 0; });
      const card = e.target.closest && e.target.closest('.spot');
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    }, { passive: true });
    document.addEventListener('pointerleave', () => document.body.classList.remove('has-cursor'));
  }

  function observeReveal() {
    const els = $$('.reveal:not([data-obs])');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach((el) => { el.classList.add('in'); el.dataset.obs = '1'; });
      $$('[data-count]').forEach(countUp);
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('in');
          $$('[data-count]', en.target).forEach(countUp);
          revealObserver.unobserve(en.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    els.forEach((el) => { el.dataset.obs = '1'; revealObserver.observe(el); });
  }

  function countUp(el) {
    el.dataset.done = '1';
    const target = Number(el.dataset.count);
    if (isNaN(target)) return;
    const plus = el.querySelector('.plus');
    const suffix = plus ? plus.outerHTML : '';
    const dec = String(el.dataset.count).includes('.') ? String(el.dataset.count).split('.')[1].length : 0;
    if (reduceMotion) { el.innerHTML = target.toFixed(dec) + suffix; return; }
    const start = performance.now(), dur = 1300;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.innerHTML = (target * eased).toFixed(dec) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* =========================================================
     Modal
     ========================================================= */
  let lastFocus = null;
  function setupModal() {
    const modal = $('#modal');
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeModal();
      const z = e.target.closest('[data-zoom]');
      if (z) openModal(`<img src="${esc(z.getAttribute('src'))}" alt="${esc(z.alt)}">`, { image: true });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.cert-thumb[data-view]')) {
        e.preventDefault(); viewCert(Number(e.target.dataset.view));
      }
    });
  }
  function openModal(html, { image = false } = {}) {
    const modal = $('#modal');
    const wasOpen = modal.classList.contains('open');
    if (!wasOpen) lastFocus = document.activeElement;
    modal.classList.toggle('image-mode', image);
    $('#modalBody').innerHTML = html;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (!wasOpen) lockScroll(true);
    const panel = $('.modal-panel', modal);
    panel.scrollTop = 0;
    setTimeout(() => panel.focus(), 50);
  }
  function closeModal() {
    const modal = $('#modal');
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    lockScroll(false);
    if (/^#proyek\//.test(location.hash)) { try { history.replaceState(null, '', '#projects'); } catch (e) { /* ignore */ } }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* =========================================================
     Command palette (Ctrl/⌘ + K)
     ========================================================= */
  let cmdItems = [], cmdFiltered = [], cmdSel = 0;
  function setupCmdk() {
    const box = $('#cmdk'), input = $('#cmdkInput'), list = $('#cmdkList');
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const kbd = $('#cmdkBtn kbd'); if (kbd && isMac) kbd.textContent = '⌘ K';
    $('#cmdkBtn').addEventListener('click', openCmdk);
    box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeCmdk(); });
    document.addEventListener('keydown', (e) => {
      const typing = /input|textarea|select/i.test((e.target.tagName || '')) || e.target.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); box.classList.contains('open') ? closeCmdk() : openCmdk(); return; }
      if (e.key === '/' && !typing && !box.classList.contains('open')) { e.preventDefault(); openCmdk(); return; }
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdFiltered[cmdSel]); }
    });
    input.addEventListener('input', () => drawCmdk(input.value));
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.cmdk-item');
      if (li) runCmd(cmdFiltered[Number(li.dataset.i)]);
    });
    list.addEventListener('mousemove', (e) => {
      const li = e.target.closest('.cmdk-item');
      if (li && Number(li.dataset.i) !== cmdSel) { cmdSel = Number(li.dataset.i); markSel(); }
    });
  }
  function buildCmdkItems() {
    const sections = [
      ['home', 'Beranda', 'home'], ['about', 'Tentang Saya', 'user'], ['skills', 'Skill & Teknologi', 'layers'],
      ['projects', 'Proyek', 'folder'], ['certificates', 'Sertifikat', 'award'], ['journey', 'Pendidikan & Pengalaman', 'graduation'],
      ['github', 'Aktivitas GitHub', 'github'], ['contact', 'Kontak', 'mail']
    ].filter(([id]) => document.getElementById(id));
    cmdItems = sections.map(([id, title, ic]) => ({ group: 'Navigasi', title, ic, hint: 'Bagian', run: () => document.getElementById(id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }) }));
    DATA.projects.forEach((p) => cmdItems.push({ group: 'Proyek', title: p.title, ic: catIcon(p.category), hint: p.category || 'Proyek', keys: (p.tags || []).join(' '), run: () => openProject(p.id) }));
    DATA.certificates.forEach((c, i) => cmdItems.push({ group: 'Sertifikat', title: c.title, ic: 'award', hint: c.issuer || 'Sertifikat', run: () => { document.getElementById('certificates').scrollIntoView(); viewCert(i); } }));
    DATA.skills.forEach((s) => cmdItems.push({ group: 'Skill', title: s.name, tech: techIcon(s.name, s.icon), hint: s.category || 'Skill', run: () => document.getElementById('skills').scrollIntoView({ behavior: 'smooth' }) }));
    allSocials().forEach((s) => {
      const meta = SOCIALS[s.platform] || SOCIALS.other;
      cmdItems.push({ group: 'Tautan', title: s.label || meta.label, ic: meta.icon, hint: 'Buka', run: () => window.open(socialHref(s), '_blank', 'noopener') });
    });
    const p = DATA.profile;
    if (p.email) cmdItems.push({ group: 'Aksi', title: 'Salin alamat email', ic: 'copy', hint: p.email, run: () => copy(p.email, 'Email disalin ke clipboard') });
    if (p.cv) cmdItems.push({ group: 'Aksi', title: 'Unduh CV', ic: 'download', hint: 'PDF', run: () => window.open(asset(p.cv), '_blank', 'noopener') });
  }
  function openCmdk() {
    const box = $('#cmdk');
    if (box.classList.contains('open')) return;
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    const input = $('#cmdkInput');
    input.value = '';
    drawCmdk('');
    setTimeout(() => input.focus(), 30);
  }
  function closeCmdk() {
    const box = $('#cmdk');
    if (!box.classList.contains('open')) return;
    box.classList.remove('open');
    box.setAttribute('aria-hidden', 'true');
    lockScroll(false);
  }
  function drawCmdk(q) {
    q = q.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    cmdFiltered = cmdItems.filter((it) => {
      if (!q) return it.group !== 'Skill';
      const hay = (it.title + ' ' + (it.hint || '') + ' ' + (it.keys || '') + ' ' + it.group).toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 40);
    cmdSel = 0;
    const list = $('#cmdkList');
    if (!cmdFiltered.length) { list.innerHTML = `<li class="cmdk-empty">Tidak ada hasil untuk “${esc(q)}”</li>`; return; }
    let html = '', group = '';
    cmdFiltered.forEach((it, i) => {
      if (it.group !== group) { group = it.group; html += `<li class="cmdk-group" role="presentation">${esc(group)}</li>`; }
      html += `<li class="cmdk-item${i === 0 ? ' sel' : ''}" role="option" data-i="${i}"><span class="ci">${it.tech || icon(it.ic)}</span><span>${esc(it.title)}</span><small>${esc(it.hint || '')}</small></li>`;
    });
    list.innerHTML = html;
  }
  function moveSel(d) {
    if (!cmdFiltered.length) return;
    cmdSel = (cmdSel + d + cmdFiltered.length) % cmdFiltered.length;
    markSel();
  }
  function markSel() {
    $$('.cmdk-item').forEach((li) => li.classList.toggle('sel', Number(li.dataset.i) === cmdSel));
    const el = $(`.cmdk-item[data-i="${cmdSel}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function runCmd(it) {
    if (!it) return;
    closeCmdk();
    setTimeout(it.run, 60);
  }
})();
