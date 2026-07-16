/**
 * LeetCode Adapter v4 — GraphQL API for code + rich metadata.
 *
 * Fetches: full code, language, difficulty, topic tags,
 *          runtime/memory stats with percentiles.
 */
class LeetCodeAdapter extends PlatformAdapter {

  static LANG_EXT = {
    'c++': 'cpp', 'cpp': 'cpp', 'c': 'c',
    'python': 'py', 'python3': 'py',
    'java': 'java', 'javascript': 'js', 'typescript': 'ts',
    'c#': 'cs', 'go': 'go', 'golang': 'go',
    'rust': 'rs', 'kotlin': 'kt', 'swift': 'swift',
    'ruby': 'rb', 'scala': 'scala', 'php': 'php',
    'dart': 'dart', 'racket': 'rkt', 'elixir': 'ex',
    'erlang': 'erl'
  };

  constructor() {
    super();
    this._submissionCache = null;
    this._questionCache = null;
    this._lastFetchedId = null;
  }

  getPlatformName() { return 'LeetCode'; }

  // ── Problem Title ─────────────────────────────────────
  getProblemTitle() {
    if (this._questionCache?.title) return this._questionCache.title;
    for (const sel of [
      'div[data-cy="question-title"]',
      'a.no-underline.text-lg',
      'div.text-title-large a',
      'span[data-e2e-locator="question-title"]',
    ]) {
      const el = document.querySelector(sel);
      if (el?.textContent.trim()) return el.textContent.trim().replace(/^\d+\.\s*/, '');
    }
    const dt = document.title;
    if (dt.includes('- LeetCode')) return dt.split('- LeetCode')[0].trim().replace(/^\d+\.\s*/, '');
    const m = location.pathname.match(/\/problems\/([^/]+)/);
    return m ? m[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
  }

  // ── Problem ID ────────────────────────────────────────
  getProblemId() {
    if (this._questionCache?.questionFrontendId) {
      return this._questionCache.questionFrontendId.padStart(4, '0');
    }
    for (const sel of [
      'div[data-cy="question-title"]',
      'a.no-underline.text-lg',
      'div.text-title-large a',
      'span[data-e2e-locator="question-title"]',
    ]) {
      const el = document.querySelector(sel);
      const m = el?.textContent.trim().match(/^(\d+)\./);
      if (m) return m[1].padStart(4, '0');
