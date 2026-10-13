// ════════════════════════════════════════════════════════════════════════
//  🖼 Image bank
//  1. School image bank — every picture the AI draws (and every photo a
//     teacher picks) is saved here by subject / grade / lesson so any teacher
//     can search and reuse it. Files live in data/imagebank/, metadata in
//     data/imagebank.json (data/ is never committed).
//  2. Free-licence photos — live search of Wikimedia Commons (CC0, public
//     domain, CC BY, CC BY-SA only). The credit line travels with the picture.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function imageBank(app, { readAll, writeAll, requireTeacher, isAdmin, claudeList }) {
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const DIR = path.join(DATA_DIR, 'imagebank');
  const BANK = 'imagebank.json';
  const UA = 'ClassCurio/1.0 (school assessment platform; https://lockdown-asessment.onrender.com)';
  const MAX_BYTES = 1500000;
  const ensureDir = () => { if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true }); };

  const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
  const words = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2);
  const parseDataUrl = (u) => {
    const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(String(u || ''));
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    return { mime: m[1].toLowerCase().replace('jpg', 'jpeg'), buf };
  };
  const extOf = (mime) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg');

  function saveToBank({ buf, mime, title, subject, grade, lesson, tags, kind, credit, sourceUrl, user }) {
    ensureDir();
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    const bank = readAll(BANK);
    const dup = bank.find((x) => x.hash === hash);
    if (dup) return dup;
    const id = 'img_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const file = id + '.' + extOf(mime);
    fs.writeFileSync(path.join(DIR, file), buf);
    const item = {
      id, file, hash, mime, bytes: buf.length,
      title: clip(title, 200) || 'Picture',
      subject: clip(subject, 60), grade: clip(grade, 10), lesson: clip(lesson, 200),
      tags: (Array.isArray(tags) ? tags : String(tags || '').split(',')).map((t) => clip(t, 40)).filter(Boolean).slice(0, 12),
      kind: kind === 'photo' ? 'photo' : 'diagram',
      credit: clip(credit, 300), sourceUrl: clip(sourceUrl, 500),
      by: user ? user.name : '', byId: user ? user.id : '', createdAt: new Date().toISOString(), uses: 0,
    };
    bank.push(item);
    writeAll(BANK, bank);
    return item;
  }
  // ── Starter pictures shipped with the app (server/imagebank-seed/) ──
  // Copied into the school bank once; matched by file hash so nothing is added twice.
  try {
    const SEED = path.join(__dirname, 'imagebank-seed');
    const list = JSON.parse(fs.readFileSync(path.join(SEED, 'seed.json'), 'utf8'));
    const bank = readAll(BANK);
    const have = new Set(bank.map((x) => x.hash));
    let added = 0;
    ensureDir();
    for (const it of list) {
      const src = path.join(SEED, it.file);
      if (!fs.existsSync(src)) continue;
      const buf = fs.readFileSync(src);
      const hash = crypto.createHash('sha1').update(buf).digest('hex');
      if (have.has(hash)) continue;
      const id = 'img_seed_' + hash.slice(0, 14);
      const file = id + '.' + extOf(it.mime);
      fs.writeFileSync(path.join(DIR, file), buf);
      bank.push({ id, file, hash, mime: it.mime, bytes: buf.length, title: clip(it.title, 200), subject: clip(it.subject, 60), grade: clip(it.grade, 10),
        lesson: clip(it.lesson, 200), tags: (it.tags || []).slice(0, 12), kind: it.kind === 'photo' ? 'photo' : 'diagram', credit: clip(it.credit, 300),
        source: clip(it.source, 200), sourceUrl: '', by: 'School slides', byId: '', seed: true, createdAt: new Date().toISOString(), uses: 0 });
      have.add(hash); added++;
    }
    if (added) { writeAll(BANK, bank); console.log('[imagebank] added ' + added + ' starter pictures'); }
  } catch (e) { if (e.code !== 'ENOENT') console.warn('[imagebank] seed:', e.message); }

  const pub = (x) => ({ id: x.id, title: x.title, subject: x.subject, grade: x.grade, lesson: x.lesson, tags: x.tags, kind: x.kind, credit: x.credit, source: x.source || '', by: x.by, createdAt: x.createdAt, uses: x.uses || 0, url: '/api/imagebank/' + x.id + '/image' });

  // ── Search the school bank ──
  app.get('/api/imagebank', requireTeacher, (req, res) => {
    const q = words(req.query.q);
    const subject = String(req.query.subject || '').toLowerCase();
    const onlySubject = req.query.only === '1';
    const kind = String(req.query.kind || '');
    let list = readAll(BANK);
    if (kind === 'photo' || kind === 'diagram') list = list.filter((x) => x.kind === kind);
    if (onlySubject && subject) list = list.filter((x) => String(x.subject || '').toLowerCase() === subject);
    // Rank by how many search words match; pictures already used are NOT hidden.
    const scored = list.map((x) => {
      const hay = words([x.title, x.lesson, (x.tags || []).join(' '), x.subject, x.source || ''].join(' '));
      let s = 0;
      for (const w of q) if (hay.some((h) => h === w || (w.length > 3 && (h.startsWith(w) || w.startsWith(h))))) s += 2;
      if (subject && String(x.subject).toLowerCase() === subject) s += 1;
      return { x, s };
    });
    let hits = q.length ? scored.filter((o) => o.s >= 2) : scored;
    const fallback = q.length > 0 && !hits.length;
    if (fallback) hits = scored;
    hits.sort((a, b) => b.s - a.s || (b.x.uses || 0) - (a.x.uses || 0) || String(b.x.createdAt).localeCompare(String(a.x.createdAt)));
    res.json({ total: list.length, fallback, items: hits.slice(0, 200).map((o) => pub(o.x)) });
  });

  app.get('/api/imagebank/:id/image', requireTeacher, (req, res) => {
    const x = readAll(BANK).find((i) => i.id === req.params.id);
    if (!x) return res.status(404).end();
    const p = path.join(DIR, x.file);
    if (!fs.existsSync(p)) return res.status(404).end();
    res.setHeader('Content-Type', x.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(p).pipe(res);
  });

  // A teacher used a bank picture — count it (most-used float up later).
  app.post('/api/imagebank/:id/used', requireTeacher, (req, res) => {
    const bank = readAll(BANK);
    const x = bank.find((i) => i.id === req.params.id);
    if (x) { x.uses = (x.uses || 0) + 1; writeAll(BANK, bank); }
    res.json({ ok: true });
  });

  app.post('/api/imagebank', requireTeacher, (req, res) => {
    const b = req.body || {};
    const d = parseDataUrl(b.dataUrl);
    if (!d) return res.status(400).json({ error: 'Not a picture.' });
    if (d.buf.length > MAX_BYTES) return res.status(413).json({ error: 'Picture is too large for the bank.' });
    const item = saveToBank(Object.assign({}, b, { buf: d.buf, mime: d.mime, user: req.session.user }));
    res.json({ ok: true, item: pub(item) });
  });

  app.delete('/api/imagebank/:id', requireTeacher, (req, res) => {
    const bank = readAll(BANK);
    const i = bank.findIndex((x) => x.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    const u = req.session.user;
    if (bank[i].byId !== u.id && !isAdmin(u)) return res.status(403).json({ error: 'Only the teacher who added it (or an admin) can remove it.' });
    try { fs.unlinkSync(path.join(DIR, bank[i].file)); } catch (e) {}
    bank.splice(i, 1);
    writeAll(BANK, bank);
    res.json({ ok: true });
  });

  // ── Wikimedia Commons (free-licence photos) ──
  const FREE = /^(cc0|cc[- ]?zero|public domain|pd\b|pd-|cc by(-sa)?( \d(\.\d)?)?$|cc-by(-sa)?-\d|cc by(-sa)? \d)/i;
  const cache = new Map();
  async function commonsSearch(q, limit) {
    const key = q.toLowerCase() + '|' + limit;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < 24 * 3600 * 1000) return hit.v;
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    const params = {
      action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6',
      gsrsearch: q + ' filetype:bitmap|drawing', gsrlimit: String(limit), prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime|size', iiurlwidth: '900',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit|ImageDescription|ObjectName|AttributionRequired|UsageTerms',
    };
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    if (!r.ok) throw new Error('Wikimedia Commons did not answer (' + r.status + ')');
    const j = await r.json();
    const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const out = [];
    for (const p of pages) {
      const ii = (p.imageinfo || [])[0];
      if (!ii || !ii.thumburl) continue;
      if (!/^image\/(jpeg|png|gif|svg\+xml|webp|tiff)/.test(ii.mime || '')) continue;
      const md = ii.extmetadata || {};
      const lic = stripHtml(md.LicenseShortName && md.LicenseShortName.value);
      if (!FREE.test(lic)) continue;
      const artist = clip(stripHtml(md.Artist && md.Artist.value), 120) || 'Unknown author';
      const title = clip(stripHtml(md.ObjectName && md.ObjectName.value) || String(p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '), 160);
      out.push({
        title, thumb: ii.thumburl, page: ii.descriptionurl || '', license: lic, artist,
        description: clip(stripHtml(md.ImageDescription && md.ImageDescription.value), 300),
        credit: `Image: ${artist}, ${lic}, via Wikimedia Commons`,
      });
    }
    cache.set(key, { t: Date.now(), v: out });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return out;
  }

  async function download(url) {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'upload.wikimedia.org') throw new Error('Only Wikimedia Commons pictures can be added.');
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('Could not download the picture (' + r.status + ')');
    const mime = String(r.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!/^image\/(png|jpeg|gif|webp)$/.test(mime)) throw new Error('Unsupported picture type.');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('Picture is too large.');
    return { buf, mime };
  }
  const toDataUrl = (d) => 'data:' + d.mime + ';base64,' + d.buf.toString('base64');

  app.get('/api/images/search', requireTeacher, async (req, res) => {
    try {
      const q = clip(req.query.q, 120);
      if (!q) return res.json({ items: [] });
      res.json({ items: await commonsSearch(q, 30) });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  app.post('/api/images/fetch', requireTeacher, async (req, res) => {
    try {
      const b = req.body || {};
      const d = await download(String(b.url || ''));
      const item = saveToBank({ buf: d.buf, mime: d.mime, title: b.title, subject: b.subject, grade: b.grade, lesson: b.lesson, tags: b.tags, kind: 'photo', credit: b.credit, sourceUrl: b.page, user: req.session.user });
      res.json({ ok: true, dataUrl: toDataUrl(d), credit: item.credit, bankId: item.id });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Automatic photo for a generated question: search Commons, let the AI pick
  // the best match (or none), download it and save it in the school bank.
  // Best school-bank matches for a question (by words in title / lesson / tags).
  function bankMatches(text, subject, n) {
    const q = words(text);
    if (!q.length) return [];
    const sub = String(subject || '').toLowerCase();
    return readAll(BANK).filter((x) => !sub || !x.subject || String(x.subject).toLowerCase() === sub).map((x) => {
      const hay = words([x.title, x.lesson, (x.tags || []).join(' ')].join(' '));
      let s = 0; for (const w of q) if (hay.some((h) => h === w || (w.length > 4 && (h.startsWith(w) || w.startsWith(h))))) s++;
      return { x, s };
    }).filter((o) => o.s >= 2).sort((a, b) => b.s - a.s || (b.x.uses || 0) - (a.x.uses || 0)).slice(0, n).map((o) => o.x);
  }

  // Automatic picture for a generated question. Looks in the school bank first,
  // then (for photos) Wikimedia Commons; the AI picks the best fit or "none".
  app.post('/api/images/auto', requireTeacher, async (req, res) => {
    try {
      const b = req.body || {};
      const bankOnly = !!b.bankOnly;
      const search = clip(b.search || b.description || b.prompt, 100);
      if (!search) return res.json({ none: true });
      const bank = bankMatches([b.search, b.description, b.prompt].join(' '), b.subject, 8);
      let web = [];
      if (!bankOnly) {
        web = await commonsSearch(search, 20).catch(() => []);
        if (!web.length) {
          const shorter = words(search).slice(0, 3).join(' ');
          if (shorter && shorter !== search.toLowerCase()) web = await commonsSearch(shorter, 20).catch(() => []);
        }
        web = web.slice(0, 10);
      }
      const cands = bank.map((x) => ({ from: 'bank', x, label: x.title + (x.lesson ? ' (' + x.lesson + ')' : '') }))
        .concat(web.map((w) => ({ from: 'web', w, label: w.title + (w.description ? ' — ' + w.description.slice(0, 160) : '') })));
      if (!cands.length) return res.json({ none: true });
      let pick = bankOnly ? null : cands[0];
      if (claudeList) {
        try {
          const list = cands.map((c, i) => `C${i + 1} [${c.from === 'bank' ? 'school bank' : 'photo library'}]: ${c.label}`).join('\n');
          const items = await claudeList({
            system: 'You choose the best picture for a school exam question. Pick only a picture that shows exactly what the question needs (right object, process, species, apparatus or diagram) and that does NOT give away the answer (e.g. no labels or values the student must work out). Prefer school-bank pictures when they fit equally well. Avoid maps, logos, documents, collages, faces and anything gory. If none fits well, answer "none".',
            user: `Subject: ${clip(b.subject, 40)}\nQuestion: ${clip(b.prompt, 600)}\nPicture needed: ${clip(b.description, 300)}\n\nCandidates:\n${list}\n\nReturn exactly one item: {"pick":"C<number>" or "none","reason":"…"}`,
            maxTokens: 300, itemProps: { pick: { type: 'string' }, reason: { type: 'string' } }, required: ['pick'],
          });
          const p = String((items && items[0] && items[0].pick) || '').trim();
          if (/^none$/i.test(p)) return res.json({ none: true });
          const n = parseInt(p.replace(/\D/g, ''), 10);
          if (n >= 1 && n <= cands.length) pick = cands[n - 1];
        } catch (e) { if (bankOnly) return res.json({ none: true }); }
      }
      if (!pick) return res.json({ none: true });
      if (pick.from === 'bank') {
        const x = pick.x;
        const buf = fs.readFileSync(path.join(DIR, x.file));
        const all = readAll(BANK); const y = all.find((i) => i.id === x.id); if (y) { y.uses = (y.uses || 0) + 1; writeAll(BANK, all); }
        return res.json({ ok: true, dataUrl: toDataUrl({ mime: x.mime, buf }), credit: x.credit || '', title: x.title, bankId: x.id, fromBank: true });
      }
      const d = await download(pick.w.thumb);
      const item = saveToBank({ buf: d.buf, mime: d.mime, title: b.description || pick.w.title, subject: b.subject, grade: b.grade, lesson: b.lesson, tags: words(search).slice(0, 8), kind: 'photo', credit: pick.w.credit, sourceUrl: pick.w.page, user: req.session.user });
      res.json({ ok: true, dataUrl: toDataUrl(d), credit: pick.w.credit, title: pick.w.title, bankId: item.id });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  return { saveToBank };
};
