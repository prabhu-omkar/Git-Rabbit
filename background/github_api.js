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
