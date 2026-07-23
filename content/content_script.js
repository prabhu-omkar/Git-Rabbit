/**
 * Content script entry point v3.
 *
 * New features:
 * - Checks local push history on widget injection → shows "synced" badge
 * - Before push, checks for duplicates on GitHub → prompts update or cancel
 * - Passes rich metadata (difficulty, tags, runtime, memory) in payload
 */
(function () {
  'use strict';

  let adapter = null;
  let injected = false;
  let intervalId = null;
  let observer = null;

  function alive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch { return false; }
  }

  function destroy() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (observer)   { observer.disconnect(); observer = null; }
    const host = document.getElementById('git-rabbit-host');
    if (host) host.remove();
  }

  function pickAdapter() {
    const h = location.hostname.toLowerCase();
    if (h.includes('leetcode.com'))      return new LeetCodeAdapter();
    if (h.includes('codeforces.com'))    return new CodeforcesAdapter();
    if (h.includes('atcoder.jp'))        return new AtCoderAdapter();
    return null;
  }

  async function tick() {
    if (!alive()) { destroy(); return; }
    if (injected || !adapter) return;
    if (!adapter.isSubmissionAccepted()) return;

    injected = true;

    // Check if this problem was already pushed (local history)
    let previouslySynced = null;
    try {
      const res = await chrome.runtime.sendMessage({
        action: 'IS_PUSHED',
        payload: {
          platformName: adapter.getPlatformName(),
          problemId: adapter.getProblemId()
        }
      });
      if (res?.pushed) previouslySynced = res.entry;
    } catch { /* ignore */ }

    const widget = new GitRabbitUIWidget(adapter, pushSolution, previouslySynced);
    widget.inject();
  }

  async function pushSolution({ notes, tc, sc, forceOverwrite }) {
    if (!alive()) return { success: false, error: 'Extension reloaded — refresh page.' };
    if (!adapter) return { success: false, error: 'No adapter.' };

    try {
      // Fetch full code from API (LeetCode GraphQL, Codeforces API)
      if (typeof adapter.fetchSubmissionCode === 'function') {
        try {
          await adapter.fetchSubmissionCode();
        } catch (fetchErr) {
          return { success: false, error: 'Failed to fetch code: ' + fetchErr.message };
        }
      }

      const platformName = adapter.getPlatformName();
      const problemId    = adapter.getProblemId();
      const problemTitle = adapter.getProblemTitle();

      // Duplicate check (GitHub) — only if not already forcing overwrite
      if (!forceOverwrite) {
        try {
          const dupRes = await chrome.runtime.sendMessage({
            action: 'CHECK_DUPLICATE',
            payload: { platformName, problemId, problemTitle }
          });
          if (dupRes?.exists) {
            return {
              success: false,
              duplicate: true,
              dir: dupRes.dir,
              error: `Already exists at ${dupRes.dir}. Click "Update" to overwrite.`
            };
          }
        } catch { /* continue with push */ }
      }
