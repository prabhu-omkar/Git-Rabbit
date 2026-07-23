/**
 * Shadow DOM widget — Monochrome Terminal Theme
 */
class GitRabbitUIWidget {
  constructor(adapter, onPush, previouslySynced) {
    this.adapter = adapter;
    this.onPush = onPush;
    this.previouslySynced = previouslySynced;
    this.host = null;
    this.shadow = null;
    this.expanded = true;
  }

  static _alive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch { return false; }
  }

  inject() {
    if (document.getElementById('git-rabbit-host')) return;
    if (!GitRabbitUIWidget._alive()) return;

    this.host = document.createElement('div');
    this.host.id = 'git-rabbit-host';
    this.host.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:2147483647;';

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const platform = this.adapter.getPlatformName();
    const title    = this.adapter.getProblemTitle();
    const id       = this.adapter.getProblemId();
    const meta     = typeof this.adapter.getMetadata === 'function' ? this.adapter.getMetadata() : {};

    const diffBadge = this._diffBadge(meta.difficulty);
    const syncBadge = this.previouslySynced
      ? `<span class="tag tag--sync" title="SYNCED: ${this.previouslySynced.timestamp?.slice(0,10)||''}">[SYNCED]</span>`
      : '';

    this.shadow.innerHTML = `
${WIDGET_STYLE}
<div class="w" id="widget">
  <div class="w__hdr">
    <div class="w__brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 16a3 3 0 0 1 2.24 5"/>
        <path d="M18 12h.01"/>
        <path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1.01 1.01 0 0 1-.1-1.52L11 3a2.02 2.02 0 0 1 2.87 0l2.56 2.56a2.01 2.01 0 0 1 0 2.87L14.7 10"/>
      </svg>
      <span>GIT-RABBIT</span>
    </div>
    <div class="w__controls">
      <button id="optBtn" class="w__btn-icon" title="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </button>
      <button id="minBtn" class="w__btn-icon" title="Minimize">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  </div>

  <div class="w__body" id="body">
    <div class="w__tags">
      <span class="tag tag--plat">[${platform}]</span>
      <span class="tag tag--ac">[AC]</span>
      ${diffBadge}
      ${syncBadge}
    </div>

    <div class="w__problem">
      <span class="w__id">${id}</span>
      <span class="w__title" title="${title}">${title}</span>
    </div>

    <div class="w__input-wrap">
      <textarea id="notes" class="w__notes" placeholder="> add notes..." spellcheck="false"></textarea>
      <div class="w__notes-cursor"></div>
    </div>
    
    <div class="w__row">
      <div class="w__input-wrap" style="flex:1;">
        <input type="text" id="tc" class="w__notes w__notes--single" placeholder="> time O(N)" spellcheck="false" />
        <div class="w__notes-cursor"></div>
      </div>
      <div class="w__input-wrap" style="flex:1;">
        <input type="text" id="sc" class="w__notes w__notes--single" placeholder="> space O(1)" spellcheck="false" />
        <div class="w__notes-cursor"></div>
      </div>
    </div>

    <div id="alert" class="w__alert hide"></div>

    <div class="w__actions">
      <button id="pushBtn" class="w__push">
        <svg id="pushIco" class="w__push-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span id="pushLbl">${this.previouslySynced ? 'UPDATE' : 'COMMIT'}</span>
      </button>
    </div>
  </div>
</div>`;

    document.body.appendChild(this.host);
    this._bind();

    requestAnimationFrame(() => {
      this.shadow.getElementById('widget').classList.add('w--in');
    });
  }

  _diffBadge(diff) {
    if (!diff) return '';
    return `<span class="tag tag--diff">[${diff.toUpperCase()}]</span>`;
  }

  _bind() {
    const s = this.shadow;
    const minBtn  = s.getElementById('minBtn');
    const body    = s.getElementById('body');
    const pushBtn = s.getElementById('pushBtn');
    const pushIco = s.getElementById('pushIco');
    const pushLbl = s.getElementById('pushLbl');
    const optBtn  = s.getElementById('optBtn');
    const notes   = s.getElementById('notes');
    const tc      = s.getElementById('tc');
    const sc      = s.getElementById('sc');
    const alert   = s.getElementById('alert');
    let forceOverwrite = !!this.previouslySynced;

    const showAlert = (msg, ok) => {
      alert.innerHTML = `> ${msg}`;
      alert.className = `w__alert ${ok ? 'ok' : 'err'}`;
    };

    minBtn.addEventListener('click', () => {
      this.expanded = !this.expanded;
      body.style.display = this.expanded ? '' : 'none';
      minBtn.innerHTML = this.expanded
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    });

    optBtn.addEventListener('click', () => {
      if (!GitRabbitUIWidget._alive()) { showAlert('ERR: EXT_RELOADED', false); return; }
      chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' }, () => { void chrome.runtime.lastError; });
    });

    pushBtn.addEventListener('click', async () => {
      alert.className = 'w__alert hide';
      if (!GitRabbitUIWidget._alive()) { showAlert('ERR: EXT_RELOADED', false); return; }

      pushBtn.disabled = true;
      pushLbl.textContent = 'COMMITTING...';

      const result = await this.onPush({
        notes: notes.value.trim(),
        tc: tc.value.trim(),
        sc: sc.value.trim(),
        forceOverwrite
      });

      if (result?.success) {
        pushIco.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        showAlert(`OK: ${(result.commitSha||'').slice(0,7)}`, true);
        pushLbl.textContent = 'DONE';
        pushBtn.classList.add('w__push--done');
      } else if (result?.duplicate) {
        showAlert('ERR: EXISTS. CLICK TO UPDATE.', false);
        pushLbl.textContent = 'UPDATE';
        pushBtn.disabled = false;
        forceOverwrite = true;
      } else {
        showAlert(`ERR: ${result?.error || 'UNKNOWN'}`, false);
        pushLbl.textContent = 'RETRY';
        pushBtn.disabled = false;
      }
    });
  }
}

/* ── Styles ───────────────────────────────────────────── */
const WIDGET_STYLE = `<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }

.w {
  width: 280px;
  background: #000;
  border: 1px solid #333;
  box-shadow: 0 0 15px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.05);
  color: #e5e5e5;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  opacity: 0; transform: translateY(10px);
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.w--in { opacity: 1; transform: translateY(0); }

.w__hdr {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 10px;
  background: #0a0a0a;
  border-bottom: 1px solid #1f1f1f;
}
.w__brand { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: #0ea5e9; }
.w__brand svg { width: 14px; height: 14px; }
.w__controls { display: flex; gap: 2px; }

.w__btn-icon {
  background: none; border: none; cursor: pointer;
  padding: 2px; color: #737373; transition: 0.2s;
}
.w__btn-icon svg { width: 14px; height: 14px; }
.w__btn-icon:hover { color: #e5e5e5; }

.w__body { padding: 10px; }

.w__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.tag { font-size: 9px; font-weight: 700; }
.tag--plat { color: #a3a3a3; }
.tag--ac { color: #10b981; }
.tag--diff { color: #fbbf24; }
.tag--sync { color: #0ea5e9; }

.w__problem { margin-bottom: 10px; display: flex; flex-direction: column; gap: 2px; }
.w__id { font-size: 10px; color: #737373; }
.w__title { font-size: 12px; font-weight: 700; color: #e5e5e5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.w__row { display: flex; gap: 6px; margin-bottom: 10px; }
.w__input-wrap { position: relative; margin-bottom: 6px; }
.w__input-wrap:last-child { margin-bottom: 0; }
.w__notes {
  width: 100%; height: 40px; resize: none;
  background: #0a0a0a; border: 1px solid #1f1f1f;
  color: #e5e5e5; padding: 6px 8px; font-size: 10px;
  font-family: 'JetBrains Mono', monospace; outline: none; transition: 0.2s;
}
.w__notes--single { height: 26px; padding: 4px 8px; }
.w__notes:focus { border-color: #0ea5e9; box-shadow: 0 0 5px rgba(14,165,233,0.2); }
.w__notes::placeholder { color: #404040; }
.w__notes-cursor {
  position: absolute; left: 8px; top: 6px;
  width: 6px; height: 12px; background: #0ea5e9;
  pointer-events: none; opacity: 0;
}
.w__notes--single + .w__notes-cursor { top: 7px; height: 10px; }
.w__notes:focus + .w__notes-cursor, .w__notes:not(:placeholder-shown) + .w__notes-cursor { display: none; }
.w__input-wrap:focus-within .w__notes:placeholder-shown + .w__notes-cursor { display: block; animation: blink 1s step-end infinite; }

.w__alert { padding: 4px 6px; font-size: 9px; margin-bottom: 10px; border-left: 2px solid; animation: glitch 0.2s; }
.w__alert.ok { background: rgba(16,185,129,0.05); color: #10b981; border-color: #10b981; }
.w__alert.err { background: rgba(239,68,68,0.05); color: #ef4444; border-color: #ef4444; }
.w__alert.hide { display: none; }

.w__actions { display: flex; }
