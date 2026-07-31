document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  const patInput      = $('pat');
  const repoInput     = $('repo');
  const branchInput   = $('branch');
  const pushReadme    = $('pushReadme');
  const alertEl       = $('alert');
  const saveBtn       = $('saveBtn');
  const saveBtnLabel  = $('saveBtnLabel');
  const testBtn       = $('testBtn');
  const togglePat     = $('togglePat');
  const eyeOpen       = $('eyeOpen');
  const eyeClosed     = $('eyeClosed');
  const statusInd     = $('statusIndicator');
  const statusText    = $('statusText');
  const guideToggle   = $('guideToggle');
  const guidePanel    = $('guidePanel');
  const form          = $('configForm');

  function parseRepo(raw) {
    if (!raw) return null;
    const s = raw.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').replace(/\.git$/i, '');
    const parts = s.split('/');
    return parts.length >= 2 ? { owner: parts[0], repo: parts[1] } : null;
  }

  function showAlert(msg, type) {
    alertEl.innerHTML = `> ${msg}`;
    alertEl.className = `alert ${type}`;
  }
  function hideAlert() { alertEl.className = 'alert hide'; }

  function setStatus(type, text) {
    statusInd.className = `hdr__status ${type}`;
    statusText.textContent = text;
  }

  function setBusy(btn, labelEl, busyText, originalText, isBusy) {
    btn.disabled = isBusy;
    labelEl.textContent = isBusy ? busyText : originalText;
  }

  function checkInputs() {
    const hasPat = patInput.value.trim().length > 0;
    const hasRepo = !!parseRepo(repoInput.value);
    saveBtn.disabled = !(hasPat && hasRepo);
    testBtn.disabled = !(hasPat && hasRepo);
  }
  patInput.addEventListener('input', checkInputs);
  repoInput.addEventListener('input', checkInputs);

  togglePat.addEventListener('click', () => {
    const show = patInput.type === 'password';
    patInput.type = show ? 'text' : 'password';
    eyeOpen.classList.toggle('hide', show);
    eyeClosed.classList.toggle('hide', !show);
  });

  guideToggle.addEventListener('click', () => {
    guidePanel.classList.toggle('open');
  });

  chrome.storage.local.get(['githubPat', 'githubRepo', 'targetBranch', 'isConnected'], s => {
    if (s.githubPat)    patInput.value = s.githubPat;
    if (s.githubRepo)   repoInput.value = s.githubRepo;
    if (s.targetBranch) branchInput.value = s.targetBranch;
    if (s.isConnected)  setStatus('ok', `[CONNECTED] ${s.githubRepo}`);
    checkInputs();
  });

  testBtn.addEventListener('click', async () => {
    hideAlert();
    const ri = parseRepo(repoInput.value);
    if (!patInput.value.trim() || !ri) return;

    setBusy(testBtn, $('testBtnLabel'), 'TESTING...', 'TEST', true);

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'TEST_CONNECTION',
        pat: patInput.value.trim(),
        owner: ri.owner,
        repo: ri.repo
      });
      if (res.success) {
        showAlert(`OK: ${ri.owner}/${ri.repo} [${res.defaultBranch}]`, 'ok');
        setStatus('ok', `[VERIFIED] ${ri.owner}/${ri.repo}`);
      } else {
        showAlert(`ERR: ${res.error}`, 'err');
        setStatus('err', 'ERR_AUTH');
      }
    } catch (e) {
      showAlert(`ERR: ${e.message}`, 'err');
    } finally {
      setBusy(testBtn, $('testBtnLabel'), 'TESTING...', 'TEST', false);
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();
    const ri = parseRepo(repoInput.value);
    if (!patInput.value.trim() || !ri) return;

    setBusy(saveBtn, saveBtnLabel, 'COMMITTING...', 'COMMIT', true);

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'SAVE_AND_INIT',
        pat: patInput.value.trim(),
        owner: ri.owner,
        repo: ri.repo,
        branch: branchInput.value.trim() || null,
        pushReadme: pushReadme.checked
      });

      if (!res.success) {
        showAlert(`ERR: ${res.error}`, 'err');
        setStatus('err', 'ERR_INIT');
        return;
      }

      let msg = `OK: ${res.owner}/${res.repo} [${res.branch}]`;
      if (res.readme?.pushed) msg += ' (README_INIT)';
      showAlert(msg, 'ok');
      setStatus('ok', `[CONNECTED] ${res.owner}/${res.repo}`);
    } catch (e) {
      showAlert(`ERR: ${e.message}`, 'err');
      setStatus('err', 'ERR_SYS');
    } finally {
      setBusy(saveBtn, saveBtnLabel, 'COMMITTING...', 'COMMIT', false);
    }
  });
});
