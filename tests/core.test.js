const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../assets/core.js');

test('direct add keeps the chosen quadrant without forcing a due date', () => {
  const state = core.createState();
  const task = core.saveTask(state, {text: '  电磁场作业  ', quadrant: 2, due: '', images: []});
  assert.equal(task.text, '电磁场作业');
  assert.equal(task.quadrant, 2);
  assert.equal(task.due, '');
  assert.equal(core.listQuadrant(state, 1).length, 0);
  assert.equal(core.listQuadrant(state, 2).length, 1);
});

test('blank input and impossible dates cannot create a task', () => {
  const state = core.createState();
  assert.throws(() => core.saveTask(state, {text: ' \n ', quadrant: 1}), /内容/);
  assert.throws(() => core.saveTask(state, {text: '作业', quadrant: 1, due: '2026-02-30'}), /日期/);
  assert.equal(state.tasks.length, 0);
});

test('editing and completing preserve the same task and image references', () => {
  const state = core.createState();
  const task = core.saveTask(state, {text: '实验报告', quadrant: 1, due: '2026-10-29', images: ['photo.jpg']});
  core.toggleDone(state, task.id);
  core.saveTask(state, {...task, text: '实验报告终稿', quadrant: 3});
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].id, task.id);
  assert.equal(state.tasks[0].done, true);
  assert.equal(state.tasks[0].due, '2026-10-29');
  assert.deepEqual(state.tasks[0].images, ['photo.jpg']);
  assert.equal(core.listQuadrant(state, 3)[0].text, '实验报告终稿');
});

test('deleting one task preserves all the other tasks', () => {
  const state = core.createState();
  const first = core.saveTask(state, {text: '买牙签', quadrant: 2});
  const second = core.saveTask(state, {text: '取快递', quadrant: 3});
  core.removeTask(state, first.id);
  assert.deepEqual(state.tasks.map(t => t.id), [second.id]);
});

test('saved data round trips attachments, dates and completion without seeding sample tasks', () => {
  const state = core.createState();
  const task = core.saveTask(state, {text: '<作业>\n第二行', quadrant: 4, due: '2027-01-01', images: ['a.png', 'b.jpg']});
  core.toggleDone(state, task.id);
  assert.deepEqual(core.deserialize(core.serialize(state)), state);
  assert.deepEqual(core.deserialize('').tasks, []);
  assert.throws(() => core.deserialize('{broken'), /./);
  assert.throws(() => core.deserialize('{"tasks":null}'), /./);
});

test('deadline labels compare calendar dates without timezone shifts', () => {
  assert.equal(core.dueLabel('2026-10-29', '2026-10-22', false), '10/29 截止');
  assert.equal(core.dueLabel('2026-10-22', '2026-10-22', false), '今天截止');
  assert.equal(core.dueLabel('2026-10-21', '2026-10-22', false), '10/21 · 已逾期');
  assert.equal(core.dueLabel('2027-01-01', '2026-10-22', false), '2027/01/01 截止');
  assert.equal(core.dueLabel('2026-10-21', '2026-10-22', true), '10/21 截止');
});

test('open dated tasks sort before undated tasks and completed tasks', () => {
  const state = core.createState();
  const done = core.saveTask(state, {text: '已完成', quadrant: 1, due: '2026-10-01'});
  core.toggleDone(state, done.id);
  core.saveTask(state, {text: '无日期', quadrant: 1});
  core.saveTask(state, {text: '较晚', quadrant: 1, due: '2026-10-29'});
  core.saveTask(state, {text: '较早', quadrant: 1, due: '2026-10-23'});
  assert.deepEqual(core.listQuadrant(state, 1).map(t => t.text), ['较早', '较晚', '无日期', '已完成']);
});

test('precise deadline time survives persistence and appears on the task', () => {
  const state = core.createState();
  core.saveTask(state, {text: '提交报告', quadrant: 1, due: '2026-10-29', time: '18:30'});
  const restored = core.deserialize(core.serialize(state));
  assert.equal(restored.tasks[0].time, '18:30');
  assert.equal(core.dueLabel('2026-10-29', '2026-10-22', false, '18:30', '12:00'), '10/29 18:30 截止');
  assert.equal(core.dueLabel('2026-10-22', '2026-10-22', false, '11:30', '12:00'), '今天 11:30 · 已逾期');
  assert.throws(() => core.saveTask(state, {text: '错误时间', quadrant: 1, due: '2026-10-22', time: '25:70'}), /时间/);
});
