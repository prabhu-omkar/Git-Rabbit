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
