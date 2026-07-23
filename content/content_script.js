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
