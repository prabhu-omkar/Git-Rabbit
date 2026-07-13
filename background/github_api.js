/**
 * GitHub API Client — Git Database API for atomic multi-file commits.
 *
 * v3: Added pathExists(), updateReadmeStats(), getDirectoryListing()
 */
export class GitHubApiClient {
  constructor(pat, owner, repo) {
    this.pat = pat;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  }

  // ─── HTTP ─────────────────────────────────────────────────────

  _headers() {
    return {
      Authorization: `token ${this.pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async _req(path, opts = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const res = await fetch(url, { ...opts, headers: { ...this._headers(), ...opts.headers } });
    if (res.status === 204) return null;
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `GitHub ${res.status}`);
    return body;
  }

  async _reqSafe(path, opts = {}) {
    try { return await this._req(path, opts); }
    catch { return null; }
  }

  // ─── Public helpers ───────────────────────────────────────────

  async getRepoInfo() {
    const r = await this._req('');
    return { owner: r.owner.login, repo: r.name, defaultBranch: r.default_branch };
  }

  async getDefaultBranch() {
    return (await this.getRepoInfo()).defaultBranch;
  }

  // ─── Path existence check (Contents API) ──────────────────────

  async pathExists(branch, path) {
    try {
      await this._req(`/contents/${path}?ref=${branch}`);
      return true;
    } catch {
      return false;
    }
  }

  // ─── List directories at a path ───────────────────────────────

  async getDirectoryListing(branch, path = '') {
    try {
      const items = await this._req(`/contents/${path}?ref=${branch}`);
      if (!Array.isArray(items)) return [];
      return items
        .filter(i => i.type === 'dir')
        .map(i => i.name);
    } catch {
      return [];
    }
  }

  // ─── Landing README (Contents API — single file) ──────────────

  async pushReadme(branch, content) {
    let sha = null;
    try {
      const f = await this._req(`/contents/README.md?ref=${branch}`);
      sha = f.sha;
    } catch (_) { /* file does not exist yet */ }

    const payload = {
      message: '📚 Initialize CP Solution Sync repository',
      content: utf8ToBase64(content),
      branch
    };
    if (sha) payload.sha = sha;

    return this._req('/contents/README.md', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  // ─── Stats README update ──────────────────────────────────────

  /**
   * Reads existing README.md, replaces the content between
   * <!-- STATS:START --> and <!-- STATS:END --> markers with
   * a freshly generated stats table. If markers don't exist,
   * appends stats section at the end (before the footer).
   */
  async updateReadmeStats(branch, statsMarkdown) {
    let existing = '';
    let sha = null;

    try {
      const f = await this._req(`/contents/README.md?ref=${branch}`);
      sha = f.sha;
      existing = base64ToUtf8(f.content);
    } catch {
      return; // no README — skip stats update
    }

    const START = '<!-- STATS:START -->';
    const END   = '<!-- STATS:END -->';
    const statsBlock = `${START}\n${statsMarkdown}\n${END}`;

    let updated;
    if (existing.includes(START) && existing.includes(END)) {
      // Replace existing stats block
      const re = new RegExp(`${escapeRegex(START)}[\\s\\S]*?${escapeRegex(END)}`);
      updated = existing.replace(re, statsBlock);
    } else {
      // Insert before footer or append at end
      const footerMarker = '<div align="center">\n<sub>';
      const idx = existing.lastIndexOf(footerMarker);
      if (idx > 0) {
        updated = existing.slice(0, idx) + statsBlock + '\n\n' + existing.slice(idx);
      } else {
        updated = existing + '\n\n' + statsBlock + '\n';
      }
    }

    if (updated === existing) return; // nothing changed

    await this._req('/contents/README.md', {
      method: 'PUT',
      body: JSON.stringify({
        message: '📊 Update solution statistics',
        content: utf8ToBase64(updated),
        sha,
        branch
      })
    });
  }

  // ─── Single-commit multi-file push (Git Data API) ─────────────
