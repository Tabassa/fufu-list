const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const qa = path.resolve(__dirname, '../qa'); fs.mkdirSync(qa, {recursive: true});
  const png = path.join(qa, 'fixture.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const context = await browser.newContext({viewport: {width: 360, height: 800}, timezoneId: 'Asia/Shanghai'});
  const page = await context.newPage(); const errors = [];
  await page.clock.install({time: new Date('2026-10-22T12:00:00+08:00')});
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/');
  assert.equal(await page.locator('.quad').count(), 4);
  for (let q = 1; q <= 4; q++) {
    await page.locator('.q' + q + ' .add-button').click();
    assert.equal(await page.locator('#task-quadrant').inputValue(), String(q));
    assert.equal(await page.locator('#editor-layer').isVisible(), true);
    await page.locator('#cancel').click();
  }
  await page.locator('.q1 .add-button').click();
  await page.locator('#task-text').fill('   '); await page.locator('#save-task').click();
  assert.equal(await page.locator('#form-error').innerText(), '请先填写待办内容');
  await page.locator('#task-text').fill('电磁场作业，下周四交');
  await page.locator('#open-date').click();
  await page.locator('[data-day="2026-10-29"]').click();
  await page.locator('#open-time').click();
  await page.locator('#hour-wheel [data-value="18"]').nth(1).click(); await page.locator('#minute-wheel [data-value="30"]').nth(1).click();
  await page.locator('#time-confirm').click();
  await page.locator('#calendar-confirm').click();
  await page.locator('#web-image-input').setInputFiles(png);
  await page.waitForFunction(() => document.querySelectorAll('.draft-picture').length === 1);
  await page.locator('#save-task').click();
  assert.equal(await page.locator('.q1 .task').count(), 1);
  assert.match(await page.locator('.q1 .due').innerText(), /10\/29/);
  assert.match(await page.locator('.q1 .due').innerText(), /18:30/);
  await page.locator('.q1 .thumb-button').click();
  assert.equal(await page.locator('#image-viewer').isVisible(), true);
  await page.locator('#close-viewer').click();
  await page.reload();
  assert.equal(await page.locator('.q1 .task').count(), 1);
  assert.equal(await page.locator('.q1 .task-images img').count(), 1);
  await page.locator('.q1 .check').click();
  assert.equal(await page.locator('.q1 .task.done').count(), 1);
  await page.locator('.q1 .check').click();
  await page.locator('.q1 .task-open').click();
  assert.equal(await page.locator('#editor-layer.editing').count(), 1);
  await page.locator('#task-text').fill('<实验报告>\n检查数据和图片');
  await page.locator('#open-priority').click(); await page.locator('[data-priority="2"]').click(); await page.locator('#header-save').click();
  assert.equal(await page.locator('.q1 .task').count(), 0);
  assert.equal(await page.locator('.q2 .task-title').innerText(), '<实验报告>\n检查数据和图片');
  assert.equal(await page.locator('.q2 .task-images img').count(), 1);
  for (const viewport of [{width: 360, height: 800}, {width: 320, height: 568}, {width: 800, height: 1280}, {width: 1280, height: 800}]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => ({
      bodyWidth: document.documentElement.scrollWidth,
      windowWidth: innerWidth,
      cards: [...document.querySelectorAll('.quad')].map(e => { const r = e.getBoundingClientRect(); const h = e.querySelector('h2'); const a = e.querySelector('.add-button'); return {right: r.right, bottom: r.bottom, width: r.width, titleWidth: h.scrollWidth, titleAvailable: h.clientWidth, addLeft: a.getBoundingClientRect().left}; })
    }));
    assert.equal(metrics.bodyWidth, metrics.windowWidth, 'no horizontal overflow at ' + viewport.width);
    for (const card of metrics.cards) {
      assert.ok(card.bottom <= viewport.height, 'four quadrants fit vertically');
      assert.ok(card.width > 100, 'quadrants remain legible');
      assert.ok(card.titleWidth <= card.titleAvailable + 1, 'header title must not overlap plus at ' + viewport.width + ': ' + JSON.stringify(card));
    }
    await page.screenshot({path: path.join(qa, 'layout-' + viewport.width + '.png')});
  }
  await page.setViewportSize({width: 360, height: 800});
  await page.locator('.q2 .task-open').click();
  await page.screenshot({path: path.join(qa, 'editor-phone.png')});
  page.once('dialog', d => d.accept()); await page.locator('#delete-task').click();
  assert.equal(await page.locator('.task').count(), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(qa, 'browser-validation.json'), JSON.stringify({checks: 'passed', viewports: [360, 320, 800, 1280], errors}, null, 2));
  console.log('PASS: four plus buttons; validation; date; picture; reload; complete; edit/move; delete; phone/tablet layouts');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
