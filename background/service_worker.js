import { GitHubApiClient } from './github_api.js';

/* ── On Install ────────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

/* ── Message Router ────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    OPEN_OPTIONS:     () => { chrome.runtime.openOptionsPage(); return { success: true }; },
    TEST_CONNECTION:  () => testConnection(msg),
    SAVE_AND_INIT:   () => saveAndInit(msg),
    PUSH_SOLUTION:   () => pushSolution(msg.payload),
    CHECK_DUPLICATE: () => checkDuplicate(msg.payload),
    IS_PUSHED:       () => isPushed(msg.payload),
    GET_PUSH_HISTORY:() => getPushHistory(),
    GET_STATS:       () => getStats(),
  };

  const handler = handlers[msg.action];
  if (!handler) return;

  Promise.resolve(handler())
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, error: err.message }));

  return true;
});

/* ── Test Connection ───────────────────────────────────────── */

async function testConnection({ pat, owner, repo }) {
  const client = new GitHubApiClient(pat, owner, repo);
  const info = await client.getRepoInfo();
  return { success: true, ...info };
}

/* ── Save & Init ───────────────────────────────────────────── */

async function saveAndInit({ pat, owner, repo, branch, pushReadme }) {
  const client = new GitHubApiClient(pat, owner, repo);
  const info = await client.getRepoInfo();
  const targetBranch = branch || info.defaultBranch;

  const fullRepo = `${info.owner}/${info.repo}`;
  await chrome.storage.local.set({
    githubPat: pat,
    githubOwner: info.owner,
    githubRepoName: info.repo,
    githubRepo: fullRepo,
    targetBranch,
    isConnected: true
  });

  let readmeResult = { pushed: false, error: null };
  if (pushReadme) {
    try {
      await client.pushReadme(targetBranch, GitHubApiClient.README_CONTENT);
      readmeResult.pushed = true;
    } catch (err) {
      readmeResult.error = err.message;
    }
  }

  return { success: true, owner: info.owner, repo: info.repo, branch: targetBranch, readme: readmeResult };
}

/* ── Check Duplicate ───────────────────────────────────────── */

async function checkDuplicate({ platformName, problemId, problemTitle }) {
  const store = await chrome.storage.local.get(['githubPat', 'githubOwner', 'githubRepoName', 'targetBranch']);
  if (!store.githubPat) return { success: true, exists: false };

  const client = new GitHubApiClient(store.githubPat, store.githubOwner, store.githubRepoName);
  const branch = store.targetBranch || await client.getDefaultBranch();

  const dirName = sanitize(problemTitle);
  const dir = `${platformName}/${problemId}-${dirName}`;
  const exists = await client.pathExists(branch, dir);

  return { success: true, exists, dir };
}

/* ── Is Pushed (local history) ─────────────────────────────── */

async function isPushed({ platformName, problemId }) {
  const store = await chrome.storage.local.get('pushHistory');
  const history = store.pushHistory || [];
  const key = `${platformName}:${problemId}`;
  const entry = history.find(h => h.key === key);
  return { success: true, pushed: !!entry, entry: entry || null };
}

/* ── Get Push History ──────────────────────────────────────── */

async function getPushHistory() {
  const store = await chrome.storage.local.get('pushHistory');
  return { success: true, history: store.pushHistory || [] };
}

/* ── Get Stats ─────────────────────────────────────────────── */

async function getStats() {
  const store = await chrome.storage.local.get('pushHistory');
  const history = store.pushHistory || [];
  return { success: true, stats: computeStats(history) };
}

/* ── Push Solution ─────────────────────────────────────────── */

async function pushSolution(payload) {
  const store = await chrome.storage.local.get(['githubPat', 'githubOwner', 'githubRepoName', 'targetBranch']);
  if (!store.githubPat || !store.githubOwner || !store.githubRepoName) {
    throw new Error('GitHub not configured. Open extension settings first.');
  }

  const client = new GitHubApiClient(store.githubPat, store.githubOwner, store.githubRepoName);
  const branch = store.targetBranch || await client.getDefaultBranch();

  const {
    platformName, problemId, problemTitle,
    problemDescription, code, languageExt,
    customNotes, timeComplexity, spaceComplexity, metadata, overwrite
  } = payload;

  const dirName = sanitize(problemTitle);
  const dir = `${platformName}/${problemId}-${dirName}`;

  // ── Build rich Notes.md ──────────────────────────────
  const notesMd = buildNotesMd({
    platformName, problemId, problemTitle,
    customNotes, timeComplexity, spaceComplexity, metadata
  });

  // ── Build Question.md header ─────────────────────────
  const files = [
    { path: `${dir}/Question.md`,                      content: problemDescription },
    { path: `${dir}/Solution.${languageExt || 'txt'}`, content: code },
    { path: `${dir}/Notes.md`,                         content: notesMd }
  ];

  const action = overwrite ? 'Update' : 'Add';
  const commitMsg = `✅ ${action} ${platformName} ${problemId}: ${problemTitle}`;
  const result = await client.pushFiles(branch, files, commitMsg);

  // ── Record in local push history ─────────────────────
  const historyStore = await chrome.storage.local.get('pushHistory');
  const history = historyStore.pushHistory || [];
  const key = `${platformName}:${problemId}`;

  // Remove old entry for same problem if updating
  const filtered = history.filter(h => h.key !== key);
  filtered.push({
    key,
    platform: platformName,
    id: problemId,
    title: problemTitle,
    difficulty: metadata?.difficulty || null,
    tags: metadata?.tags || [],
    lang: languageExt || 'txt',
    commitSha: result.commitSha,
    dir,
    timestamp: new Date().toISOString()
  });

  await chrome.storage.local.set({ pushHistory: filtered });

  // ── Update README stats (non-blocking) ───────────────
  updateReadmeStatsAsync(client, branch, filtered);

  return { success: true, commitSha: result.commitSha, dir, branch };
}

/* ── Rich Notes.md Builder ─────────────────────────────────── */

function buildNotesMd({ platformName, problemId, problemTitle, customNotes, timeComplexity, spaceComplexity, metadata }) {
  const m = metadata || {};
  const lines = [];

  lines.push(`# 📝 Notes — ${platformName} ${problemId}: ${problemTitle}`, '');

  // Metadata section
  if (m.difficulty || m.tags?.length || m.runtime || m.memory || timeComplexity || spaceComplexity) {
    lines.push('## 📊 Submission Stats', '');
    lines.push('| Metric | Value |');
    lines.push('|:-------|:------|');
    if (m.difficulty) lines.push(`| **Difficulty** | ${m.difficulty} |`);
    if (m.tags?.length) lines.push(`| **Topics** | ${m.tags.join(', ')} |`);
    if (timeComplexity) lines.push(`| **Time Complexity** | \`${timeComplexity}\` |`);
    if (spaceComplexity) lines.push(`| **Space Complexity** | \`${spaceComplexity}\` |`);
    if (m.runtime) {
      const rt = m.runtimePct ? `${m.runtime} (beats ${m.runtimePct})` : m.runtime;
      lines.push(`| **Runtime** | ${rt} |`);
    }
    if (m.memory) {
      const mem = m.memoryPct ? `${m.memory} (beats ${m.memoryPct})` : m.memory;
      lines.push(`| **Memory** | ${mem} |`);
    }
    if (m.lang) lines.push(`| **Language** | ${m.lang} |`);
    lines.push('');
  }

  // User notes section
  lines.push('## 💡 Approach', '');

  if (customNotes && customNotes !== 'No notes provided.') {
    lines.push(customNotes);
  } else {
    lines.push('_No notes provided._');
  }

  lines.push('');
  lines.push('## ⏱️ Complexity Analysis', '');
  lines.push(`- **Time:** \`${timeComplexity || 'O(?)'}\``);
  lines.push(`- **Space:** \`${spaceComplexity || 'O(?)'}\``);
  lines.push('');
  lines.push('---');
  lines.push(`> Synced on ${new Date().toISOString().slice(0, 10)} via **Git-Rabbit**`);

  return lines.join('\n');
}

/* ── Stats Computation ─────────────────────────────────────── */

function computeStats(history) {
  const byPlatform = {};
  const byDifficulty = {};
  const byLang = {};

  for (const h of history) {
    byPlatform[h.platform] = (byPlatform[h.platform] || 0) + 1;
    if (h.difficulty) {
      // Normalize: "Easy", "Medium", "Hard", "CF 1200", etc.
      const d = h.difficulty.replace(/^CF\s*/, 'CF ');
      byDifficulty[d] = (byDifficulty[d] || 0) + 1;
    }
    if (h.lang) byLang[h.lang] = (byLang[h.lang] || 0) + 1;
  }

  return {
    total: history.length,
    byPlatform,
    byDifficulty,
    byLang,
    lastPush: history.length ? history[history.length - 1].timestamp : null
  };
}

/* ── Stats README Update (fire-and-forget) ─────────────────── */

async function updateReadmeStatsAsync(client, branch, history) {
  try {
    const stats = computeStats(history);
    const md = buildStatsMarkdown(stats);
    await client.updateReadmeStats(branch, md);
  } catch {
    // Non-critical — don't let stats failure break the push
