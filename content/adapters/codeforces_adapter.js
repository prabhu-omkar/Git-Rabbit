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
    // Submission page: /contest/123/submission/456
    m = p.match(/\/contest\/(\d+)\/submission/i);
    if (m) return { contestId: m[1], index: null };
    return { contestId: null, index: null };
  }

  _getSubmissionIdFromUrl() {
    const m = location.pathname.match(/\/submission\/(\d+)/);
    return m ? m[1] : null;
  }

  // ── CODEFORCES API ────────────────────────────────────

  async fetchSubmissionCode() {
    const { contestId } = this._parseProblemFromUrl();

    // Fetch problem tags/rating
    const metaPromise = this._problemCache
      ? Promise.resolve()
      : this._fetchProblemMeta();

    // Fetch submission code
    let codePromise = Promise.resolve();
    const subId = this._getSubmissionIdFromUrl();
    if (subId && contestId) {
      codePromise = this._fetchSubmissionFromApi(contestId, subId);
    }
    // If not on a submission page, DOM scraping handles it via getSubmittedCode()

    await Promise.all([metaPromise, codePromise]);
    return this._submissionCache;
  }

  async _fetchSubmissionFromApi(contestId, submissionId) {
    try {
      const url = `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=&from=1&count=50`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const json = await resp.json();
      if (json.status !== 'OK') return;

      const sub = json.result.find(s => String(s.id) === String(submissionId));
      if (!sub) return;

      this._submissionCache = {
        code: null, // API doesn't return code source for others' submissions
        lang: sub.programmingLanguage || '',
        timeMs: sub.timeConsumedMillis,
        memoryBytes: sub.memoryConsumedBytes,
      };

      // Try to get actual code from the submission page DOM
      if (!this._submissionCache.code) {
        const codeEl = document.querySelector('#program-source-text') ||
                       document.querySelector('pre.prettyprint');
        if (codeEl) this._submissionCache.code = codeEl.textContent.trim();
      }
    } catch {
      // Fall back to DOM scraping
    }
  }

  async _fetchProblemMeta() {
    try {
      const { contestId, index } = this._parseProblemFromUrl();
      if (!contestId) return;

      const url = `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1&showUnofficial=false`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const json = await resp.json();
      if (json.status !== 'OK') return;

      const problems = json.result?.problems || [];
      const match = index
        ? problems.find(p => p.index.toUpperCase() === index.toUpperCase())
        : problems[0];

      if (match) {
        this._problemCache = {
          name: match.name,
          rating: match.rating || null,
          tags: match.tags || [],
          contestId: match.contestId,
          index: match.index,
        };
      }
    } catch {
      // Silently fail
    }
  }
}

/* ── CF HTML → Markdown ──────────────────────────────── */

function cfHtmlToMd(el) {
  function walk(n) {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent;
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = n.tagName.toLowerCase();
    const inner = () => Array.from(n.childNodes).map(walk).join('');
    switch (tag) {
      case 'div':
        return n.classList.contains('section-title') ? `\n### ${inner().trim()}\n\n` : `\n${inner()}\n`;
      case 'p':  return `\n${inner().trim()}\n\n`;
      case 'strong': case 'b': return `**${inner()}**`;
      case 'em': case 'i':    return `*${inner()}*`;
      case 'pre':  return `\n\`\`\`\n${inner().trim()}\n\`\`\`\n\n`;
      case 'ul':   return `\n${inner()}\n`;
      case 'li':   return `- ${inner().trim()}\n`;
      case 'span':
        return n.classList.contains('tex-span') ? ` $${inner().trim()}$ ` : inner();
      default: return inner();
    }
  }
  return walk(el).replace(/\n{3,}/g, '\n\n').trim();
}
