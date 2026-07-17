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
    return '// Code not yet fetched.';
  }

  // ── Language ──────────────────────────────────────────
  getLanguageExtension() {
    if (this._submissionCache?.lang) {
      const lang = this._submissionCache.lang.toLowerCase();
      for (const [k, v] of Object.entries(LeetCodeAdapter.LANG_EXT))
        if (lang.includes(k)) return v;
    }
    for (const sel of [
      'button[id*="headlessui-listbox-button"]',
      'div[class*="css-"] button',
    ]) {
      const el = document.querySelector(sel);
      const t = el?.textContent.trim().toLowerCase();
      if (t) for (const [k, v] of Object.entries(LeetCodeAdapter.LANG_EXT))
        if (t.includes(k)) return v;
    }
    return 'cpp';
  }

  // ── Accepted ──────────────────────────────────────────
  isSubmissionAccepted() {
    for (const sel of [
      'span[data-e2e-locator="submission-result"]',
      'span[class*="text-sd-positive"]',
      'span.text-green-s',
    ]) {
      const el = document.querySelector(sel);
      if (el?.textContent.trim().toLowerCase().includes('accepted')) return true;
    }
    return false;
  }

  // ── Rich metadata accessor ────────────────────────────
  getMetadata() {
    const q = this._questionCache || {};
    const s = this._submissionCache || {};
    return {
      difficulty:  q.difficulty || null,
      tags:        (q.topicTags || []).map(t => t.name),
      acRate:      q.acRate ? parseFloat(q.acRate).toFixed(1) + '%' : null,
      runtime:     s.runtimeDisplay || null,
      memory:      s.memoryDisplay || null,
      runtimePct:  s.runtimePercentile ? parseFloat(s.runtimePercentile).toFixed(1) + '%' : null,
      memoryPct:   s.memoryPercentile ? parseFloat(s.memoryPercentile).toFixed(1) + '%' : null,
      lang:        s.lang || null,
    };
  }

  // ── URL helpers ───────────────────────────────────────
  _getProblemSlug() {
    const m = location.pathname.match(/\/problems\/([^/]+)/);
    return m ? m[1] : null;
  }

  _getSubmissionIdFromUrl() {
    const m = location.pathname.match(/\/submissions\/(\d+)/);
    return m ? m[1] : null;
  }

  // ─────────────────────────────────────────────────────
  // GRAPHQL API
  // ─────────────────────────────────────────────────────

  async _gql(query, variables) {
    const resp = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      credentials: 'include'
    });
    if (!resp.ok) throw new Error(`LeetCode API ${resp.status}`);
    return resp.json();
  }

  /** Fetch question metadata: difficulty, tags, acceptance rate */
  async fetchQuestionData() {
    const slug = this._getProblemSlug();
    if (!slug) return;

    const query = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
          title
          difficulty
          acRate
          topicTags { name slug }
        }
      }
    `;
    const json = await this._gql(query, { titleSlug: slug });
    this._questionCache = json?.data?.question || null;
  }

  /** Fetch full submission code + performance stats */
  async fetchSubmissionCode() {
    // Also fetch question metadata in parallel
    const metaPromise = this._questionCache ? Promise.resolve() : this.fetchQuestionData();

    const subId = this._getSubmissionIdFromUrl();
    const codePromise = subId
      ? this._fetchSubmissionById(subId)
      : this._fetchLatestAccepted(this._getProblemSlug());

    await Promise.all([metaPromise, codePromise]);
    return this._submissionCache;
  }

  async _fetchSubmissionById(submissionId) {
    if (this._lastFetchedId === submissionId && this._submissionCache) {
      return this._submissionCache;
    }

    const query = `
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          code
          lang { name verboseName }
          statusDisplay
          timestamp
          runtimeDisplay
          memoryDisplay
