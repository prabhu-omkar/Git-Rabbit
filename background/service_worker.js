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
