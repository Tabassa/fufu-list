/* Basic task rendering/CRUD adapted from priority-matrix (MIT, Omer Shubi).
   Chinese four-quadrant UI, deadlines, attachments and native storage added for 夫夫清单. */
(function () {
  'use strict';
  const C = window.FufuCore, $ = s => document.querySelector(s);
  const names = ['重要且紧急', '重要不紧急', '不重要紧急', '不重要不紧急'];
  const native = window.NativeBridge;
  const key = 'fufu-list.v1';
  let state, draft = null, importing = false, readingFailed = false, preview = [], previewIndex = 0;
  const imageURL = file => file.startsWith('data:') ? file : 'https://fufu.local/images/' + encodeURIComponent(file);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  try { state = C.deserialize(native ? native.loadState() : localStorage.getItem(key)); }
  catch (e) { state = C.createState(); readingFailed = true; $('#notice').hidden = false; $('#notice').textContent = '本地任务暂时无法读取，原文件已保留。请勿卸载 App。'; }

  function commit(next) {
    if (readingFailed) throw new Error('请先恢复本地任务数据');
    const raw = C.serialize(next);
    if (native) { if (native.saveState(raw) !== 'ok') throw new Error('保存失败，请重试'); }
    else localStorage.setItem(key, raw);
    state = next;
    render();
  }
  function mutate(action) {
    try { const next = C.deserialize(C.serialize(state)); action(next); commit(next); }
    catch (e) { alert(e.message); }
  }
  function thumb(file, label, action) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'thumb-button'; button.setAttribute('aria-label', label);
    const img = document.createElement('img'); img.src = imageURL(file); img.alt = label; img.loading = 'lazy';
    button.appendChild(img); button.addEventListener('click', action); return button;
  }
  function render() {
    const board = $('#board'), scroll = Array.from(board.querySelectorAll('.quad-body')).map(body => body.scrollTop); board.replaceChildren();
    names.forEach((name, i) => {
      const q = i + 1, quad = document.createElement('section'); quad.className = 'quad q' + q; quad.dataset.quadrant = q;
      const heading = document.createElement('header'); heading.className = 'quad-heading';
      const symbol = document.createElement('span'); symbol.className = 'quadrant-symbol'; symbol.setAttribute('aria-hidden', 'true');
      for (let j = 0; j < 4; j++) { const dot = document.createElement('i'); if (j === i) dot.className = 'active'; symbol.appendChild(dot); }
      const title = document.createElement('h2'); title.textContent = name;
      const add = document.createElement('button'); add.className = 'add-button'; add.textContent = '＋'; add.setAttribute('aria-label', '添加' + name + '待办'); add.disabled = readingFailed;
      add.addEventListener('click', () => openEditor(q)); heading.append(symbol, title, add);
      const body = document.createElement('div'); body.className = 'quad-body';
      const tasks = C.listQuadrant(state, q);
      if (!tasks.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '暂无待办'; const help = document.createElement('small'); help.textContent = '点右上角 ＋ 添加'; empty.appendChild(help); body.appendChild(empty); }
      tasks.forEach(t => {
        const row = document.createElement('article'); row.className = 'task' + (t.done ? ' done' : ''); row.dataset.id = t.id;
        const check = document.createElement('button'); check.className = 'check'; check.setAttribute('aria-label', (t.done ? '恢复待办：' : '完成待办：') + t.text); check.setAttribute('aria-pressed', String(t.done));
        const tick = document.createElement('span'); tick.textContent = '✓'; check.appendChild(tick); check.addEventListener('click', () => mutate(s => C.toggleDone(s, t.id)));
        const content = document.createElement('div'); content.className = 'task-content';
        const open = document.createElement('button'); open.className = 'task-open'; open.setAttribute('aria-label', '编辑：' + t.text); open.addEventListener('click', () => openEditor(q, t));
        if (t.due) { const due = document.createElement('span'); due.className = 'due' + (!t.done && t.due <= today() ? ' urgent' : ''); const now = new Date(); const clock = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); due.textContent = C.dueLabel(t.due, today(), t.done, t.time, clock); open.appendChild(due); }
        const text = document.createElement('span'); text.className = 'task-title'; text.textContent = t.text; open.appendChild(text); content.appendChild(open);
        if (t.images.length) { const images = document.createElement('div'); images.className = 'task-images'; t.images.slice(0, 3).forEach((file, index) => { const button = thumb(file, '查看附件图片 ' + (index + 1), () => showImages(t.images, index)); if (index === 2 && t.images.length > 3) { const more = document.createElement('span'); more.className = 'more-images'; more.textContent = '+' + (t.images.length - 2); button.appendChild(more); } images.appendChild(button); }); content.appendChild(images); }
        row.append(check, content); body.appendChild(row);
      });
      quad.append(heading, body); board.appendChild(quad);
      body.scrollTop = scroll[i] || 0;
    });
    const count = state.tasks.filter(t => !t.done).length;
    $('#summary').textContent = count ? count + ' 项待办' : '四象限';
  }
  function rememberDraft() {
    if (draft) localStorage.setItem(key + '.draft', JSON.stringify({...draft, text: $('#task-text').value, quadrant: Number($('#task-quadrant').value), due: $('#task-due').value}));
  }
  function setImporting(value) {
    importing = value;
    ['#save-task', '#header-save', '#delete-task', '#cancel', '#add-images'].forEach(id => { $(id).disabled = value; });
    $('#add-images').textContent = value ? '正在导入…' : '＋ 添加图片';
  }
  function openEditor(q, task, recovered) {
    draft = recovered || (task ? {...task, images: task.images.slice()} : {text: '', quadrant: q, due: '', time: '', images: []});
    $('#editor-title').textContent = task ? '编辑待办' : '添加待办'; $('#task-text').value = draft.text; $('#task-quadrant').value = draft.quadrant; $('#task-due').value = draft.due;
    $('#delete-task').hidden = !task; $('#form-error').hidden = true; $('#editor-layer').classList.toggle('editing', !!task); $('#editor-layer').hidden = false; updateDateSummary(); renderDraftImages();
    rememberDraft();
    if (!task && !recovered) { $('#task-text').focus(); if (native) native.showKeyboard(); }
  }
  function updateDateSummary() {
    const due = $('#task-due').value;
    $('#open-date').textContent = due ? due.replace(/-/g, '/') + (draft.time ? ' ' + draft.time : '') + '  ›' : '未设置  ›';
    $('#clear-date').hidden = !due;
  }
  function closeEditor() {
    if (importing) return;
    $('#task-text').blur(); $('#editor-layer').hidden = true; draft = null;
    localStorage.removeItem(key + '.draft');
    if (native) { native.hideKeyboard(); native.cleanImages(C.serialize(state)); }
  }
  function renderDraftImages() {
    const holder = $('#draft-images'); holder.replaceChildren();
    draft.images.forEach((file, i) => { const wrap = document.createElement('div'); wrap.className = 'draft-picture'; wrap.appendChild(thumb(file, '预览附件 ' + (i + 1), () => showImages(draft.images, i))); const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-image'; remove.textContent = '×'; remove.setAttribute('aria-label', '移除附件 ' + (i + 1)); remove.addEventListener('click', () => { draft.images.splice(i, 1); renderDraftImages(); rememberDraft(); }); wrap.appendChild(remove); holder.appendChild(wrap); });
  }
  window.onImagesPicked = function (files, message, token) {
    setImporting(false);
    if (readingFailed) return false;
    if (token && localStorage.getItem(key + '.image-result') === token) return true;
    if (!draft) { if (native) native.cleanImages(C.serialize(state)); return true; }
    draft.images.push(...files.filter(file => !draft.images.includes(file))); renderDraftImages(); rememberDraft();
    if (token) localStorage.setItem(key + '.image-result', token);
    if (message) { $('#form-error').textContent = message; $('#form-error').hidden = false; }
    return true;
  };
  $('#add-images').addEventListener('click', () => { $('#task-text').blur(); rememberDraft(); if (native) { setImporting(true); native.pickImages(); } else $('#web-image-input').click(); });
  $('#web-image-input').addEventListener('change', async e => {
    setImporting(true);
    try { const files = await Promise.all(Array.from(e.target.files).map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }))); window.onImagesPicked(files, ''); }
    catch (error) { window.onImagesPicked([], '图片未能读取，请重试'); }
    e.target.value = '';
  });
  $('#task-form').addEventListener('submit', e => {
    e.preventDefault();
    if (importing) return;
    try { const next = C.deserialize(C.serialize(state)); C.saveTask(next, {...draft, text: $('#task-text').value, quadrant: Number($('#task-quadrant').value), due: $('#task-due').value}); commit(next); closeEditor(); }
    catch (error) { $('#form-error').textContent = error.message; $('#form-error').hidden = false; }
  });
  $('#task-text').addEventListener('input', rememberDraft);
  $('#task-quadrant').addEventListener('change', rememberDraft);
  $('#open-date').addEventListener('click', () => { $('#task-text').blur(); if (native) native.hideKeyboard(); window.FufuCalendar.open($('#task-due').value, draft.time, (date, time) => { $('#task-due').value = date; draft.time = time; updateDateSummary(); rememberDraft(); }); });
  $('#clear-date').addEventListener('click', () => { $('#task-due').value = ''; draft.time = ''; updateDateSummary(); rememberDraft(); });
  $('#header-save').addEventListener('click', () => $('#task-form').requestSubmit());
  $('#cancel').addEventListener('click', closeEditor);
  $('#editor-layer').addEventListener('click', e => { if (e.target === $('#editor-layer')) closeEditor(); });
  $('#delete-task').addEventListener('click', () => { if (!importing && draft && confirm('删除这条待办？删除后无法恢复。')) { const next = C.deserialize(C.serialize(state)); C.removeTask(next, draft.id); try { commit(next); closeEditor(); } catch (e) { $('#form-error').textContent = e.message; $('#form-error').hidden = false; } } });

  let scale = 1, translateX = 0, translateY = 0, gesture = null;
  function transform() { $('#full-image').style.transform = 'translate(' + translateX + 'px,' + translateY + 'px) scale(' + scale + ')'; }
  function displayImage() { scale = 1; translateX = translateY = 0; transform(); $('#full-image').src = imageURL(preview[previewIndex]); $('#image-position').textContent = (previewIndex + 1) + ' / ' + preview.length; $('#previous-image').disabled = previewIndex === 0; $('#next-image').disabled = previewIndex === preview.length - 1; }
  function showImages(files, index) { preview = files.slice(); previewIndex = index; $('#image-viewer').hidden = false; displayImage(); }
  function closeViewer() { $('#image-viewer').hidden = true; $('#full-image').removeAttribute('src'); }
  $('#close-viewer').addEventListener('click', closeViewer);
  $('#previous-image').addEventListener('click', () => { if (previewIndex > 0) { previewIndex--; displayImage(); } });
  $('#next-image').addEventListener('click', () => { if (previewIndex < preview.length - 1) { previewIndex++; displayImage(); } });
  const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  $('#image-surface').addEventListener('touchstart', e => { if (e.touches.length === 2) gesture = {distance: distance(e.touches), scale}; else gesture = {x: e.touches[0].clientX, y: e.touches[0].clientY, translateX, translateY}; }, {passive: true});
  $('#image-surface').addEventListener('touchmove', e => { e.preventDefault(); if (!gesture) return; if (e.touches.length === 2 && gesture.distance) scale = Math.min(5, Math.max(1, gesture.scale * distance(e.touches) / gesture.distance)); else if (e.touches.length === 1 && gesture.x !== undefined && scale > 1) { translateX = gesture.translateX + e.touches[0].clientX - gesture.x; translateY = gesture.translateY + e.touches[0].clientY - gesture.y; } transform(); }, {passive: false});
  $('#image-surface').addEventListener('touchend', () => { gesture = null; });
  window.handleBack = function () { if (!$('#image-viewer').hidden) { closeViewer(); return true; } if (window.FufuCalendar.close()) return true; if (draft) { closeEditor(); return true; } return false; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.handleBack(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(() => { if (!document.hidden) render(); }, 60000);
  render();
  if (!readingFailed) {
    try { const saved = JSON.parse(localStorage.getItem(key + '.draft')); if (saved) { openEditor(saved.quadrant, saved.id ? saved : null, saved); if (native) setImporting(native.isPicking()); } }
    catch (error) { localStorage.removeItem(key + '.draft'); }
  }
})();
