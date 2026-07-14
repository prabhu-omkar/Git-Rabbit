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

  async pushFiles(branch, files, commitMessage) {
    const blobShas = await Promise.all(
      files.map(f =>
        this._req('/git/blobs', {
          method: 'POST',
          body: JSON.stringify({ content: utf8ToBase64(f.content), encoding: 'base64' })
        }).then(b => b.sha)
      )
    );

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const ref = await this._req(`/git/ref/heads/${branch}`);
        const latestCommitSha = ref.object.sha;

        const commitObj = await this._req(`/git/commits/${latestCommitSha}`);
        const baseTreeSha = commitObj.tree.sha;

        const tree = files.map((f, i) => ({
          path: f.path, mode: '100644', type: 'blob', sha: blobShas[i]
        }));

        const newTree = await this._req('/git/trees', {
          method: 'POST',
          body: JSON.stringify({ base_tree: baseTreeSha, tree })
        });

        const newCommit = await this._req('/git/commits', {
          method: 'POST',
          body: JSON.stringify({
            message: commitMessage,
            tree: newTree.sha,
            parents: [latestCommitSha]
          })
        });

        await this._req(`/git/refs/heads/${branch}`, {
          method: 'PATCH',
          body: JSON.stringify({ sha: newCommit.sha })
        });

        return { commitSha: newCommit.sha, treeSha: newTree.sha };
      } catch (err) {
        if (attempt < MAX_RETRIES && /fast.forward/i.test(err.message)) {
          await delay(500 * attempt);
          continue;
        }
        throw err;
      }
    }
  }

  // ─── Default README content ───────────────────────────────────

  static get README_CONTENT() {
    return `<div align="center">

# 🏆 Competitive Programming Vault

**An automated, meticulously organized archive of competitive programming solutions.**<br/>
Auto-synced from LeetCode, Codeforces, and AtCoder via **[Git-Rabbit](https://github.com/prabhu-omkar/Git-Rabbit)**.

<br/>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Actively_Solving-0ea5e9?style=for-the-badge&logo=github&logoColor=white" alt="Status" />
  <img src="https://img.shields.io/badge/Algorithms-Optimized-10b981?style=for-the-badge" alt="Algorithms" />
</p>

</div>

---

## 📖 Overview

This repository serves as a personal knowledge base and portfolio for algorithmic problem-solving. Every solution here has been officially evaluated and accepted by the respective platform's judging system. 

Each entry is automatically documented with:
- The full problem statement and constraints.
- The accepted source code.
- Detailed metadata including time complexity, space complexity, execution time, and memory usage.

---

## 📊 Live Statistics

> [!NOTE]  
> The statistics below are dynamically updated on every successful commit by Git-Rabbit.

<!-- STATS:START -->
<!-- STATS:END -->

---

## 🏗️ Repository Structure

Solutions are organized strictly by platform, problem ID, and title. A typical solution directory looks like this:

\`\`\`text
📦 competitive-programming/
├── 📁 LeetCode/
│   ├── 📁 0001-Two-Sum/
│   │   ├── 📄 Question.md        # Full problem statement and rules
│   │   ├── 📄 Solution.cpp       # The accepted algorithm code
│   │   └── 📄 Notes.md           # Time/Space complexities, tags, and stats
│   └── ...
├── 📁 Codeforces/
│   └── 📁 1500A-Watermelon/
│       └── ...
└── 📄 README.md                  # This live dashboard
\`\`\`

---

## 🚀 Supported Platforms

| Platform | Domain | Integration Method |
|:---------|:-------|:-------------------|
| <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" width="14"/> **LeetCode** | \`leetcode.com\` | GraphQL API |
| <img src="https://upload.wikimedia.org/wikipedia/commons/b/b1/Codeforces_logo.svg" width="14"/> **Codeforces** | \`codeforces.com\` | Public REST API |
| **AtCoder** | \`atcoder.jp\` | Kenkoooo API |

---

<div align="center">
<sub>Powered by <strong><a href="https://github.com/prabhu-omkar/Git-Rabbit">Git-Rabbit</a></strong> 🐇</sub>
</div>
`;
  }
}

// ─── Utilities ──────────────────────────────────────────────────

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
