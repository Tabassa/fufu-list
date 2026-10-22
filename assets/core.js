/* Task CRUD adapted from priority-matrix, MIT, Copyright (c) 2026 Omer Shubi.
   Source: github.com/OmerShubi/priority-matrix. See THIRD_PARTY_NOTICES.txt. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FufuCore = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const QUADS = [1, 2, 3, 4];
  function createState() { return {version: 1, tasks: []}; }
  function validDate(value) {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }
  function normalize(t) {
    const text = String(t.text || '').trim();
    const due = String(t.due || '');
    const time = String(t.time || '');
    if (!text) throw new Error('请先填写待办内容');
    if (!validDate(due)) throw new Error('请选择有效日期');
    if (time && (!due || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('请选择有效时间');
    if (!QUADS.includes(Number(t.quadrant))) throw new Error('请选择所属象限');
    return {id: Number(t.id), text, quadrant: Number(t.quadrant), done: !!t.done,
      createdAt: t.createdAt || Date.now(), due, time,
      images: Array.isArray(t.images) ? t.images.filter(x => typeof x === 'string') : []};
  }
  function saveTask(state, draft) {
    const existing = state.tasks.find(t => t.id === Number(draft.id));
    const task = normalize({...existing, ...draft,
      id: existing ? existing.id : state.tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1});
    if (existing) state.tasks[state.tasks.indexOf(existing)] = task;
    else state.tasks.push(task);
    return task;
  }
  function toggleDone(state, id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) task.done = !task.done;
  }
  function removeTask(state, id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
  }
  function serialize(state) { return JSON.stringify({version: 1, tasks: state.tasks}); }
  function deserialize(raw) {
    if (!raw) return createState();
    const state = JSON.parse(raw);
    if (!state || !Array.isArray(state.tasks)) throw new Error('本地任务数据无法读取');
    const tasks = state.tasks.map(normalize);
    if (tasks.some(t => !Number.isSafeInteger(t.id) || t.id < 1) ||
        new Set(tasks.map(t => t.id)).size !== tasks.length) throw new Error('本地任务编号有误');
    return {version: 1, tasks};
  }
  function dueLabel(due, today, done, time, clock) {
    if (!due) return '';
    const date = due.slice(0, 4) === today.slice(0, 4) ? due.slice(5).replace('-', '/') : due.replace(/-/g, '/');
    if (!done && due === today && !time) return '今天截止';
    const label = (!done && due === today ? '今天' : date) + (time ? ' ' + time : '');
    const overdue = !done && (due < today || (due === today && time && clock && time < clock));
    return label + (overdue ? ' · 已逾期' : ' 截止');
  }
  function listQuadrant(state, q) {
    return state.tasks.filter(t => t.quadrant === q).sort((a, b) =>
      Number(a.done) - Number(b.done) || ((a.due || '9999') + (a.time || '23:59')).localeCompare((b.due || '9999') + (b.time || '23:59')) || a.id - b.id);
  }
  return {createState, saveTask, toggleDone, removeTask, serialize, deserialize, dueLabel, listQuadrant};
});
