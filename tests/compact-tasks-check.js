const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const page = await browser.newPage({viewport: {width: 360, height: 800}, timezoneId: 'Asia/Shanghai'}), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({time: new Date('2026-10-22T12:00:00+08:00')});
  await page.goto('http://127.0.0.1:8766/');
  const longText = '# 实验安排\n' + Array.from({length: 100}, (_, i) => '第' + (i + 1) + '项：检查实验数据并记录结果。').join('\n');
  await page.evaluate(text => {
    const C = window.FufuCore, state = C.createState();
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    C.saveTask(state, {text: '报名', quadrant: 1});
    C.saveTask(state, {text, quadrant: 1, due: '2026-10-29', time: '18:30'});
    C.saveTask(state, {text: 'https://github.com/Tabassa/fufu-list#' + '超长链接'.repeat(30), quadrant: 1, due: '2027-10-22', time: '20:00', images: [image, image, image]});
    const done = C.saveTask(state, {text, quadrant: 2}); C.toggleDone(state, done.id);
    C.saveTask(state, {text: '带图片的短待办', quadrant: 3, images: [image]});
    C.saveTask(state, {text: '复习', quadrant: 4, due: '2026-10-30'});
    C.saveTask(state, {text: '取快递', quadrant: 1, due: '2026-10-30'});
    localStorage.setItem('fufu-list.v1', C.serialize(state));
  }, longText);
  await page.reload();
  for (const view of ['matrix', 'timeline']) {
    await page.locator('#open-modes').click(); await page.locator('[data-view="' + view + '"]').click();
    for (const viewport of [{width: 360, height: 800}, {width: 320, height: 568}, {width: 800, height: 1280}, {width: 1280, height: 800}]) {
      await page.setViewportSize(viewport);
      const metrics = await page.locator('.task').evaluateAll(rows => rows.map(row => {
        const title = row.querySelector('.task-title'), rect = row.getBoundingClientRect();
        return {height: rect.height, titleHeight: title.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(title).lineHeight)};
      }));
      assert.equal(metrics.length, 7);
      assert.ok(metrics.every(row => Math.abs(row.height - metrics[0].height) < .1), 'short/long/dated/undated/attached/completed rows have equal heights at ' + view + ' ' + viewport.width);
      assert.ok(metrics.every(row => row.titleHeight <= row.lineHeight * 2 + 1), 'overview text is at most two lines');
      assert.equal(await page.locator('.task img').count(), 0, 'attachments are not rendered or loaded in either overview');
      const fits = await page.locator('.task-open').evaluateAll(buttons => buttons.every(button => {
        const due = button.querySelector('.due'), title = button.querySelector('.task-title');
        return button.clientHeight + 1 >= due.getBoundingClientRect().height + parseFloat(getComputedStyle(due).marginBottom) + title.getBoundingClientRect().height;
      }));
      assert.ok(fits, 'date and both title lines fit in the compact row');
      if (view === 'matrix' && viewport.width === 360) {
        const capacity = await page.locator('.q1 .quad-body').evaluate(body => body.clientHeight / body.querySelector('.task').getBoundingClientRect().height);
        assert.ok(capacity >= 3.2 && capacity <= 3.8, 'one normal phone quadrant shows about 3.5 tasks, got ' + capacity);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width, 'no horizontal overflow');
      if (view === 'matrix' && viewport.width === 360) await page.screenshot({path: path.resolve(__dirname, '../qa/compact-tasks-phone.png')});
    }
  }
  await page.setViewportSize({width: 360, height: 800});
  await page.locator('.task[data-id="2"] .task-open').click();
  assert.equal(await page.locator('#task-text').inputValue(), longText);
  let area = await page.locator('#task-text').evaluate(element => ({height: element.clientHeight, scroll: element.scrollHeight}));
  assert.ok(area.height > 2000 && area.scroll <= area.height + 1, 'detail field expands to full text without an inner scrollbar');
  assert.ok(await page.locator('.editing .sheet-body').evaluate(element => element.scrollHeight > element.clientHeight), 'detail page itself scrolls');
  await page.screenshot({path: path.resolve(__dirname, '../qa/expanded-detail-phone.png')});
  await page.locator('#task-text').fill('缩短正文');
  assert.ok(await page.locator('#task-text').evaluate(element => element.clientHeight) < 200, 'detail field shrinks after editing');
  await page.setViewportSize({width: 360, height: 450});
  await page.locator('#task-text').fill(Array.from({length: 100}, (_, i) => 'Line ' + (i + 1)).join('\n'));
  await page.locator('#task-text').focus(); await page.keyboard.press('Control+End');
  await page.evaluate(() => {
    const text = document.querySelector('#task-text'), body = document.querySelector('.editing .sheet-body'), style = getComputedStyle(text);
    const caretBottom = text.getBoundingClientRect().top + parseFloat(style.paddingTop) + text.value.split('\n').length * parseFloat(style.lineHeight) - text.scrollTop;
    body.scrollTop += caretBottom - body.getBoundingClientRect().top - body.clientHeight / 2;
  });
  const beforeTyping = await page.locator('.editing .sheet-body').evaluate(element => element.scrollTop);
  await page.keyboard.type('a');
  const afterTyping = await page.locator('.editing .sheet-body').evaluate(element => element.scrollTop);
  assert.ok(Math.abs(afterTyping - beforeTyping) < 2, 'typing without a height change does not jump the scrolled detail page: ' + beforeTyping + ' -> ' + afterTyping);
  await page.evaluate(() => {
    const text = document.querySelector('#task-text'), body = document.querySelector('.editing .sheet-body'), style = getComputedStyle(text);
    const caretBottom = text.getBoundingClientRect().top + parseFloat(style.paddingTop) + text.value.split('\n').length * parseFloat(style.lineHeight) - text.scrollTop;
    body.scrollTop += caretBottom - body.getBoundingClientRect().bottom + 2;
  });
  await page.keyboard.press('Enter'); await page.keyboard.type('Next line');
  const caret = await page.evaluate(() => {
    const text = document.querySelector('#task-text'), body = document.querySelector('.editing .sheet-body').getBoundingClientRect(), style = getComputedStyle(text), lineHeight = parseFloat(style.lineHeight), fontSize = parseFloat(style.fontSize);
    const top = text.getBoundingClientRect().top + parseFloat(style.paddingTop) + (text.value.split('\n').length - 1) * lineHeight + (lineHeight - fontSize) / 2 - text.scrollTop;
    return {top, bottom: top + fontSize, bodyTop: body.top, bodyBottom: body.bottom};
  });
  await page.screenshot({path: path.resolve(__dirname, '../qa/compact-typing-keyboard.png')});
  assert.ok(caret.top >= caret.bodyTop - 1 && caret.bottom <= caret.bodyBottom + 1, 'new lines keep the typing caret visible: ' + JSON.stringify(caret));
  await page.locator('#task-text').fill(longText + '\n最后一行：完整保存。');
  await page.setViewportSize({width: 800, height: 1280});
  area = await page.locator('#task-text').evaluate(element => ({height: element.clientHeight, scroll: element.scrollHeight}));
  assert.ok(area.scroll <= area.height + 1, 'expanded detail reflows on screen width changes');
  await page.locator('#header-save').click();
  await page.reload();
  await page.locator('.task[data-id="2"] .task-open').click();
  assert.equal(await page.locator('#task-text').inputValue(), longText + '\n最后一行：完整保存。');
  await page.locator('#cancel').click();
  await page.locator('.task[data-id="3"] .task-open').click();
  assert.equal(await page.locator('#draft-images .thumb-button').count(), 3, 'all attachments are available inside details');
  await page.locator('#draft-images .thumb-button').first().click();
  assert.equal(await page.locator('#image-viewer').isVisible(), true, 'detail thumbnails open saved attachments');
  assert.match(await page.locator('#image-position').innerText(), /1\s*\/\s*3/);
  await page.locator('#close-viewer').click();
  await page.locator('#cancel').click();
  await page.clock.runFor(60000);
  assert.equal(await page.locator('.task[data-id="1"] .due').innerText(), '未设日期');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: equal overview rows across phones/tablets and both modes; two-line previews; expanding/reflowing details; full text and attachments preserved');
})().catch(error => { console.error(error); process.exit(1); });
