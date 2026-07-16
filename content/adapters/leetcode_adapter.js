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
    }
    const dm = document.title.match(/^(\d+)\./);
    if (dm) return dm[1].padStart(4, '0');
    return '0000';
  }

  // ── Problem Description (with metadata header) ────────
  getProblemDescription() {
    const id = this.getProblemId();
    const title = this.getProblemTitle();
    const meta = this._questionCache;

    const lines = [`# ${id}. ${title}`, ''];

    // Metadata badge row
    if (meta) {
      const badges = [];
      if (meta.difficulty) badges.push(`**Difficulty:** ${meta.difficulty}`);
      if (meta.topicTags?.length) {
        badges.push(`**Tags:** ${meta.topicTags.map(t => `\`${t.name}\``).join(', ')}`);
      }
      if (badges.length) {
        lines.push(badges.join(' · '), '');
      }
      if (meta.acRate) {
        lines.push(`**Acceptance Rate:** ${parseFloat(meta.acRate).toFixed(1)}%`, '');
      }
      lines.push('---', '');
    }

    // Scraped description
    for (const sel of [
      'div[data-track-load="description_content"]',
      'div.elfjS',
      'div._1l1MA',
    ]) {
      const el = document.querySelector(sel);
      if (el) {
        lines.push(htmlToMd(el));
        return lines.join('\n');
      }
    }

    lines.push('_Description could not be scraped._');
    return lines.join('\n');
  }

  // ── Code ──────────────────────────────────────────────
  getSubmittedCode() {
    if (this._submissionCache?.code) return this._submissionCache.code;
