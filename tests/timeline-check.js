const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const page = await browser.newPage({viewport: {width: 360, height: 800}, timezoneId: 'Asia/Shanghai'});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({time: new Date('2026-10-22T12:00:00+08:00')});
  await page.goto('http://127.0.0.1:8766/');
  await page.locator('.q1 .add-button').click();
  await page.locator('#task-text').fill('学习任务，下午提交');
  async function due(date, hour, minute) {
    await page.locator('#open-date').click(); await page.locator('[data-day="' + date + '"]').click();
    await page.locator('#open-time').click();
    await page.locator('#hour-wheel [data-value="' + hour + '"]').nth(1).click();
    await page.locator('#minute-wheel [data-value="' + minute + '"]').nth(1).click();
    await page.locator('#time-confirm').click(); await page.locator('#calendar-confirm').click();
  }
  await due('2026-10-23', 18, 30); await page.locator('#save-task').click();
  for (const task of [{q: 3, text: '今天较早的事', date: '2026-10-22', hour: 14, minute: 0}, {q: 4, text: '没有日期的事'}, {q: 2, text: '明天上午的事', date: '2026-10-23', hour: 9, minute: 0}]) {
    await page.locator('.q' + task.q + ' .add-button').click(); await page.locator('#task-text').fill(task.text);
    if (task.date) await due(task.date, task.hour, task.minute);
    await page.locator('#save-task').click();
  }
  assert.equal(await page.locator('#open-modes').count(), 1, 'top-left quadrant icon opens mode selection');
  await page.locator('#open-modes').click();
  assert.equal(await page.locator('.view-option').count(), 2, 'only matrix and timeline modes');
  await page.locator('[data-view="timeline"]').click();
  assert.equal(await page.locator('#board').isVisible(), false);
  assert.equal(await page.locator('#view-title').innerText(), '时间轴模式');
  assert.deepEqual(await page.locator('#timeline .task-title').allInnerTexts(), ['今天较早的事', '明天上午的事', '学习任务，下午提交', '没有日期的事']);
  await page.screenshot({path: path.resolve(__dirname, '../qa/timeline-phone.png')});
  await page.reload();
  assert.equal(await page.locator('#timeline').isVisible(), true);
  assert.equal(await page.locator('#timeline .task').count(), 4);
  await page.clock.setSystemTime(new Date('2026-10-23T00:00:00+08:00')); await page.clock.runFor(60000);
  assert.ok((await page.locator('.timeline-group h2').allInnerTexts()).some(label => label.startsWith('今天')), 'timeline day headings refresh after midnight');
  await page.locator('#timeline .task-open').filter({hasText: '学习任务'}).click();
  assert.match(await page.locator('#open-priority').innerText(), /重要且紧急\s+›/);
  await page.locator('#cancel').click();
  await page.locator('#open-modes').click(); await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator('.q1 .task').count(), 1);
  assert.equal(await page.locator('.q2 .task').count(), 1);
  assert.equal(await page.locator('.q3 .task').count(), 1);
  assert.equal(await page.locator('.q4 .task').count(), 1);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: top-left two-mode switch; chronological cross-quadrant timeline; persistence; priority retained');
})().catch(e => { console.error(e); process.exit(1); });
