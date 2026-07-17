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
