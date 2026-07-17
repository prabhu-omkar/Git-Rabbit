/**
 * Codeforces Adapter v2 — uses Codeforces public API for reliable data.
 *
 * API: https://codeforces.com/api/
 *   - contest.status: fetch submission code by contest+submissionId
 *   - problemset.problems: fetch problem tags & rating
 *
 * Falls back to DOM scraping when API is unavailable.
 */
class CodeforcesAdapter extends PlatformAdapter {

  static LANG_MAP = {
    'gnu c++': 'cpp', 'c++': 'cpp', 'clang++': 'cpp', 'gcc': 'cpp',
    'python': 'py', 'pypy': 'py',
    'java': 'java', 'kotlin': 'kt',
    'c#': 'cs', 'mono': 'cs',
    'rust': 'rs', 'go': 'go', 'ruby': 'rb',
    'javascript': 'js', 'node': 'js',
    'pascal': 'pas', 'd': 'd', 'haskell': 'hs'
  };

  constructor() {
    super();
    this._submissionCache = null;
    this._problemCache = null;
  }

  getPlatformName() { return 'Codeforces'; }

  // ── Problem Title ─────────────────────────────────────
  getProblemTitle() {
    if (this._problemCache?.name) return this._problemCache.name;
    const el = document.querySelector('.problem-statement .title');
    if (el) return el.textContent.trim().replace(/^[A-Z0-9]+\.\s*/, '');
    return document.title.includes('Codeforces') ? document.title.split('-')[0].trim() : 'Unknown';
  }

  // ── Problem ID ────────────────────────────────────────
  getProblemId() {
    const { contestId, index } = this._parseProblemFromUrl();
    if (contestId && index) return `${contestId}${index}`;
    const el = document.querySelector('.problem-statement .title');
    const m = el?.textContent.trim().match(/^([A-Z0-9]+)\./i);
    return m ? m[1].toUpperCase() : '000A';
  }

  // ── Problem Description ───────────────────────────────
  getProblemDescription() {
    const id = this.getProblemId();
    const title = this.getProblemTitle();
    const meta = this.getMetadata();

    const lines = [`# ${id} — ${title}`, ''];
    if (meta.rating) lines.push(`**Rating:** ${meta.rating}`);
    if (meta.tags?.length) lines.push(`**Tags:** ${meta.tags.map(t => `\`${t}\``).join(', ')}`);
    if (meta.rating || meta.tags?.length) lines.push('', '---', '');

    const el = document.querySelector('.problem-statement');
    if (el) {
      const clone = el.cloneNode(true);
      const hEl = clone.querySelector('.header');
      if (hEl) {
        const tl = hEl.querySelector('.time-limit')?.textContent.trim();
        const ml = hEl.querySelector('.memory-limit')?.textContent.trim();
        if (tl) lines.push(`> **${tl}**`);
        if (ml) lines.push(`> **${ml}**`, '');
        hEl.remove();
      }
      lines.push(cfHtmlToMd(clone));
    } else {
      lines.push('_Description unavailable._');
    }
    return lines.join('\n');
  }

  // ── Code ──────────────────────────────────────────────
  getSubmittedCode() {
    if (this._submissionCache?.code) return this._submissionCache.code;
    // DOM fallback
    for (const sel of [
      '#program-source-text', 'pre.prettyprint', 'pre#submission-code', 'pre'
    ]) {
      const el = document.querySelector(sel);
      if (el?.textContent.trim()) return el.textContent.trim();
    }
    return '// Code could not be scraped.';
  }

  // ── Language ──────────────────────────────────────────
  getLanguageExtension() {
    if (this._submissionCache?.lang) {
      const l = this._submissionCache.lang.toLowerCase();
      for (const [k, v] of Object.entries(CodeforcesAdapter.LANG_MAP))
        if (l.includes(k)) return v;
    }
    // DOM fallback
    for (const sel of [
      'td.status-verdict-cell ~ td', '.verdict-format ~ td',
      'select[name="programTypeId"] option:checked'
    ]) {
      const el = document.querySelector(sel);
      const t = el?.textContent.trim().toLowerCase();
      if (t) for (const [k, v] of Object.entries(CodeforcesAdapter.LANG_MAP))
        if (t.includes(k)) return v;
    }
    return 'cpp';
  }

  // ── Accepted ──────────────────────────────────────────
  isSubmissionAccepted() {
    if (document.querySelector('.verdict-accepted')) return true;
    const body = document.body.innerText;
    return /\bAccepted\b/.test(body) || body.includes('Verdict: OK');
  }

  // ── Metadata ──────────────────────────────────────────
  getMetadata() {
    const p = this._problemCache || {};
    const s = this._submissionCache || {};
    return {
      difficulty: p.rating ? `CF ${p.rating}` : null,
      tags: p.tags || [],
      rating: p.rating || null,
      runtime: s.timeMs ? `${s.timeMs} ms` : null,
      memory: s.memoryBytes ? `${Math.round(s.memoryBytes / 1024)} KB` : null,
      lang: s.lang || null,
    };
  }

  // ── URL parsing ───────────────────────────────────────
  _parseProblemFromUrl() {
    const p = location.pathname;
    let m = p.match(/\/contest\/(\d+)\/problem\/([A-Z0-9]+)/i) ||
            p.match(/\/problemset\/problem\/(\d+)\/([A-Z0-9]+)/i);
    if (m) return { contestId: m[1], index: m[2].toUpperCase() };
