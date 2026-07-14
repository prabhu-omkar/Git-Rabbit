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
