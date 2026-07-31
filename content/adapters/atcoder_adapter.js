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
      tags: [],
      point: p.point || null,
      solverCount: p.solverCount || null,
      runtime: s.executionTime || null,
      memory: s.memoryKb ? `${s.memoryKb} KB` : null,
      lang: s.lang || null,
    };
  }

  // ─────────────────────────────────────────────────────
  // API INTEGRATION
  // ─────────────────────────────────────────────────────

  async fetchSubmissionCode() {
    const { contest, task, submissionId } = this._parseUrl();

    // Fetch problem metadata from kenkoooo API (parallel)
    const metaPromise = this._problemCache
      ? Promise.resolve()
      : this._fetchProblemMeta(task);

    // Fetch submission code
    let codePromise;
    if (submissionId) {
      // On submission detail page — scrape code from DOM (it's fully rendered)
      codePromise = this._fetchSubmissionFromPage(contest, submissionId);
    } else if (contest && task) {
      // On problem page — find latest AC submission via AtCoder's submission list
      codePromise = this._fetchLatestAcSubmission(contest, task);
    } else {
      codePromise = Promise.resolve();
    }

    await Promise.all([metaPromise, codePromise]);
    return this._submissionCache;
  }

  /** Fetch problem metadata from kenkoooo's AtCoder Problems API */
  async _fetchProblemMeta(taskId) {
    if (!taskId) return;
    try {
      const url = 'https://kenkoooo.com/atcoder/resources/merged-problems.json';
      const resp = await fetch(url);
      if (!resp.ok) return;
      const problems = await resp.json();
      const match = problems.find(p => p.id === taskId);
      if (match) {
        this._problemCache = {
          title: match.title || null,
          point: match.point || null,
          solverCount: match.solver_count || null,
          contestId: match.contest_id || null,
        };
      }
    } catch { /* silently fail */ }
  }

  /** Scrape code from submission detail page */
  async _fetchSubmissionFromPage(contest, submissionId) {
    try {
      // If we're on the submission page, code is in the DOM
      const pre = document.querySelector('#submission-code');
      if (pre?.textContent.trim()) {
        // Also grab language and execution time from the table
        this._submissionCache = {
          code: pre.textContent.trim(),
          lang: this._scrapeLangFromPage(),
          executionTime: this._scrapeStatFromPage('Time'),
          memoryKb: this._scrapeMemoryFromPage(),
        };
        return;
      }

      // If not on the page, fetch it
      const resp = await fetch(`https://atcoder.jp/contests/${contest}/submissions/${submissionId}`);
      if (!resp.ok) return;
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const codePre = doc.querySelector('#submission-code');
      if (codePre) {
        this._submissionCache = {
          code: codePre.textContent.trim(),
          lang: null,
          executionTime: null,
          memoryKb: null,
        };
      }
    } catch { /* silently fail */ }
  }

  /** Fetch latest AC submission for a task using AtCoder's submission list */
  async _fetchLatestAcSubmission(contest, task) {
    try {
      // AtCoder's submission page with filters
      const url = `https://atcoder.jp/contests/${contest}/submissions/me?f.Task=${task}&f.Status=AC`;
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) return;
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Find the first submission link in the table
      const rows = doc.querySelectorAll('table tbody tr');
      if (rows.length === 0) return;

      const firstRow = rows[0];
      const link = firstRow.querySelector('td a[href*="/submissions/"]');
      if (!link) return;

      const subMatch = link.getAttribute('href').match(/\/submissions\/(\d+)/);
      if (!subMatch) return;

      const subId = subMatch[1];

      // Fetch the submission code
      const langCell = firstRow.querySelectorAll('td');
      const lang = langCell[3]?.textContent.trim() || null;
      const execTime = langCell[7]?.textContent.trim() || null;
      const memoryText = langCell[8]?.textContent.trim() || null;

      // Now fetch the actual code
      await this._fetchSubmissionFromPage(contest, subId);

      // Merge metadata from the list row
      if (this._submissionCache) {
        this._submissionCache.lang = this._submissionCache.lang || lang;
        this._submissionCache.executionTime = this._submissionCache.executionTime || execTime;
        if (memoryText) {
          const kb = parseInt(memoryText.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(kb)) this._submissionCache.memoryKb = kb;
        }
      }
    } catch { /* silently fail */ }
  }

  _scrapeLangFromPage() {
    const rows = document.querySelectorAll('#main-container table tr');
    for (const row of rows) {
      const th = row.querySelector('th');
      if (th?.textContent.includes('Language')) {
        return row.querySelector('td')?.textContent.trim() || null;
      }
    }
    return null;
  }

  _scrapeStatFromPage(label) {
    const rows = document.querySelectorAll('#main-container table tr');
    for (const row of rows) {
      const th = row.querySelector('th');
      if (th?.textContent.includes(label)) {
        return row.querySelector('td')?.textContent.trim() || null;
      }
    }
    return null;
  }

  _scrapeMemoryFromPage() {
    const val = this._scrapeStatFromPage('Memory');
    if (!val) return null;
    const kb = parseInt(val.replace(/[^0-9]/g, ''), 10);
    return isNaN(kb) ? null : kb;
  }
}

/* ── HTML → Markdown (shared for AtCoder) ────────────── */
function acHtmlToMd(el) {
  function walk(n) {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent;
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = n.tagName.toLowerCase();
    const inner = () => Array.from(n.childNodes).map(walk).join('');
    switch (tag) {
      case 'h1': return `\n# ${inner().trim()}\n\n`;
      case 'h2': return `\n## ${inner().trim()}\n\n`;
      case 'h3': return `\n### ${inner().trim()}\n\n`;
      case 'p':  return `\n${inner().trim()}\n\n`;
      case 'br': return '\n';
      case 'strong': case 'b': return `**${inner()}**`;
      case 'em': case 'i':    return `*${inner()}*`;
      case 'code': return n.parentElement?.tagName === 'PRE' ? inner() : `\`${inner()}\``;
      case 'pre':  return `\n\`\`\`\n${inner().trim()}\n\`\`\`\n\n`;
      case 'ul': case 'ol': return `\n${inner()}\n`;
      case 'li':  return `- ${inner().trim()}\n`;
      case 'var': return `$${inner().trim()}$`;
      case 'img': return `![${n.alt || ''}](${n.src || ''})`;
      default:    return inner();
    }
  }
  return walk(el).replace(/\n{3,}/g, '\n\n').trim();
}
