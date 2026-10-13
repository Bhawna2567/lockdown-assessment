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
  const pub = (x) => ({ id: x.id, title: x.title, subject: x.subject, grade: x.grade, lesson: x.lesson, tags: x.tags, kind: x.kind, credit: x.credit, by: x.by, createdAt: x.createdAt, uses: x.uses || 0, url: '/api/imagebank/' + x.id + '/image' });

  // ── Search the school bank ──
  app.get('/api/imagebank', requireTeacher, (req, res) => {
    const q = words(req.query.q);
    const subject = String(req.query.subject || '').toLowerCase();
    const kind = String(req.query.kind || '');
    let list = readAll(BANK);
    if (kind === 'photo' || kind === 'diagram') list = list.filter((x) => x.kind === kind);
    const scored = list.map((x) => {
      const hay = words([x.title, x.lesson, (x.tags || []).join(' '), x.subject].join(' '));
      let s = 0;
      for (const w of q) if (hay.some((h) => h === w || h.startsWith(w) || w.startsWith(h))) s += 2;
      if (subject && String(x.subject).toLowerCase() === subject) s += 1;
      return { x, s };
    }).filter((o) => !q.length || o.s >= Math.max(2, q.length));
    scored.sort((a, b) => b.s - a.s || String(b.x.createdAt).localeCompare(String(a.x.createdAt)));
    res.json({ total: list.length, items: scored.slice(0, 120).map((o) => pub(o.x)) });
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
  app.post('/api/images/auto', requireTeacher, async (req, res) => {
    try {
      const b = req.body || {};
      const search = clip(b.search || b.description || b.prompt, 100);
      if (!search) return res.json({ none: true });
      let cands = await commonsSearch(search, 20);
      if (!cands.length) {
        const shorter = words(search).slice(0, 3).join(' ');
        if (shorter && shorter !== search.toLowerCase()) cands = await commonsSearch(shorter, 20);
      }
      cands = cands.slice(0, 12);
      if (!cands.length) return res.json({ none: true });
      let pick = cands[0];
      if (claudeList) {
        try {
          const list = cands.map((c, i) => `C${i + 1}: ${c.title}${c.description ? ' — ' + c.description.slice(0, 160) : ''}`).join('\n');
          const items = await claudeList({
            system: 'You choose the best picture for a school exam question. Pick a clear, school-appropriate picture that shows exactly what the question needs (right object, right species/part/apparatus). Avoid maps, logos, documents, collages, people\'s faces and anything gory. If none fits, answer "none".',
            user: `Subject: ${clip(b.subject, 40)}\nQuestion: ${clip(b.prompt, 600)}\nPicture needed: ${clip(b.description, 300)}\n\nCandidates:\n${list}\n\nReturn exactly one item: {"pick":"C<number>" or "none","reason":"…"}`,
            maxTokens: 300, itemProps: { pick: { type: 'string' }, reason: { type: 'string' } }, required: ['pick'],
          });
          const p = String((items && items[0] && items[0].pick) || '').trim();
          if (/^none$/i.test(p)) return res.json({ none: true });
          const n = parseInt(p.replace(/\D/g, ''), 10);
          if (n >= 1 && n <= cands.length) pick = cands[n - 1];
        } catch (e) { /* keep the top search result */ }
      }
      const d = await download(pick.thumb);
      const item = saveToBank({ buf: d.buf, mime: d.mime, title: b.description || pick.title, subject: b.subject, grade: b.grade, lesson: b.lesson, tags: words(search).slice(0, 8), kind: 'photo', credit: pick.credit, sourceUrl: pick.page, user: req.session.user });
      res.json({ ok: true, dataUrl: toDataUrl(d), credit: pick.credit, title: pick.title, bankId: item.id });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  return { saveToBank };
};
