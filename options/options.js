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
