/**
 * AtCoder Adapter v2 — API-driven.
 *
 * APIs used:
 *   - atcoder.jp/contests/{contest}/tasks/{task}  (page scrape for description)
 *   - kenkoooo.com/atcoder/resources/merged-problems.json (problem metadata: point, solver count)
 *   - atcoder.jp/contests/{contest}/submissions/{id} (submission page for code)
 *   - atcoder.jp internal submission list API for fetching latest AC
 *
 * Note: AtCoder doesn't have a formal public API for submissions, but their
 * submission list page returns JSON when fetched with proper headers.
 * kenkoooo's AtCoder Problems API is the de facto standard for metadata.
 */
class AtCoderAdapter extends PlatformAdapter {

  static LANG_MAP = {
    'c++': 'cpp', 'gcc': 'cpp', 'g++': 'cpp', 'clang++': 'cpp',
    'python': 'py', 'pypy': 'py', 'cpython': 'py',
    'java': 'java', 'kotlin': 'kt',
    'c#': 'cs', 'rust': 'rs', 'go': 'go', 'golang': 'go',
    'ruby': 'rb', 'javascript': 'js', 'node': 'js',
    'haskell': 'hs', 'nim': 'nim'
  };

  constructor() {
    super();
    this._submissionCache = null;
    this._problemCache = null;
  }

  getPlatformName() { return 'AtCoder'; }

  // ── URL parsing ───────────────────────────────────────
  _parseUrl() {
    // /contests/abc200/tasks/abc200_a  OR  /contests/abc200/submissions/12345
    const m = location.pathname.match(/\/contests\/([^/]+)\/tasks\/([^/]+)/);
    if (m) return { contest: m[1], task: m[2], submissionId: null };
    const s = location.pathname.match(/\/contests\/([^/]+)\/submissions\/(\d+)/);
    if (s) return { contest: s[1], task: null, submissionId: s[2] };
    return { contest: null, task: null, submissionId: null };
  }

  // ── Problem Title ─────────────────────────────────────
  getProblemTitle() {
    if (this._problemCache?.title) return this._problemCache.title;
    // DOM: <span class="h2"> or the main title element
    const el = document.querySelector('#main-container .h2') ||
               document.querySelector('h2') ||
               document.querySelector('.contest-title');
    if (el?.textContent.trim()) {
      // Format: "A - Watermelon" → extract "Watermelon"
      const text = el.textContent.trim();
      const dashIdx = text.indexOf(' - ');
      return dashIdx > 0 ? text.slice(dashIdx + 3).trim() : text;
    }
    const dt = document.title;
    return dt.includes('AtCoder') ? dt.split('-')[0].trim() : 'Unknown';
  }

  // ── Problem ID ────────────────────────────────────────
  getProblemId() {
    const { task } = this._parseUrl();
    return task || 'task';
  }

  // ── Problem Description ───────────────────────────────
  getProblemDescription() {
    const id = this.getProblemId();
    const title = this.getProblemTitle();
    const meta = this.getMetadata();

    const lines = [`# ${id} — ${title}`, ''];
    if (meta.point) lines.push(`**Score:** ${meta.point} pts`);
    if (meta.solverCount) lines.push(`**Solvers:** ${meta.solverCount}`);
    if (meta.point || meta.solverCount) lines.push('', '---', '');

    // Scrape the problem statement from the page
    const el = document.querySelector('#task-statement') ||
               document.querySelector('.lang-en') ||
               document.querySelector('.lang-ja');
    if (el) {
      lines.push(acHtmlToMd(el));
    } else {
      lines.push('_Description unavailable._');
    }
    return lines.join('\n');
  }

  // ── Code ──────────────────────────────────────────────
  getSubmittedCode() {
    if (this._submissionCache?.code) return this._submissionCache.code;
    // DOM fallback for submission detail pages
    const pre = document.querySelector('#submission-code') ||
                document.querySelector('pre.plain') ||
                document.querySelector('pre');
    if (pre?.textContent.trim()) return pre.textContent.trim();
    return '// Code could not be scraped.';
  }

  // ── Language ──────────────────────────────────────────
  getLanguageExtension() {
    if (this._submissionCache?.lang) {
      const l = this._submissionCache.lang.toLowerCase();
      for (const [k, v] of Object.entries(AtCoderAdapter.LANG_MAP))
        if (l.includes(k)) return v;
    }
    // DOM fallback
    const el = document.querySelector('select[name="data.LanguageId"] option:checked') ||
               document.querySelector('.select2-selection__rendered') ||
               document.querySelector('td.text-center:nth-child(4)');
    const t = el?.textContent.trim().toLowerCase() || '';
    for (const [k, v] of Object.entries(AtCoderAdapter.LANG_MAP))
      if (t.includes(k)) return v;
    return 'cpp';
  }

  // ── Accepted ──────────────────────────────────────────
  isSubmissionAccepted() {
    // Green AC label on submission page
    const label = document.querySelector('.label-success');
    if (label?.textContent.trim() === 'AC') return true;
    // Submission result in table rows
    const cells = document.querySelectorAll('td.text-center');
    for (const c of cells) {
      if (c.textContent.trim() === 'AC') return true;
    }
    return false;
  }

  // ── Metadata ──────────────────────────────────────────
  getMetadata() {
    const p = this._problemCache || {};
    const s = this._submissionCache || {};
    return {
      difficulty: p.point ? `${p.point} pts` : null,
