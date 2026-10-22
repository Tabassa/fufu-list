const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const context = await browser.newContext({viewport: {width: 360, height: 800}});
  // Replace only the Android boundary, so a deliberately delayed image import is repeatable.
  await context.addInitScript(() => {
    window.NativeBridge = {
      loadState: () => localStorage.getItem('simulateReadError') ? '!READ_ERROR!' : localStorage.getItem('native-state') || '',
      saveState: raw => { localStorage.setItem('native-state', raw); return 'ok'; },
      cleanImages: raw => localStorage.setItem('native-cleaned', raw), showKeyboard: () => {}, hideKeyboard: () => {},
      pickImages: () => sessionStorage.setItem('picking', 'yes'),
      isPicking: () => sessionStorage.getItem('picking') === 'yes'
    };
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8766/');
  await page.locator('.q1 .add-button').click();
  await page.locator('#task-text').fill('选图期间保留的草稿');
  await page.locator('#add-images').click();
  assert.equal(await page.locator('#save-task').isDisabled(), true, 'do not save unfinished imports');
  assert.equal(await page.locator('#cancel').isDisabled(), true, 'do not switch to another task mid-import');
  assert.equal(await page.evaluate(() => window.handleBack()), true);
  assert.equal(await page.locator('#editor-layer').isVisible(), true);
  // Recreating the page represents Android recreating the Activity behind DocumentsUI.
  await page.reload();
  assert.equal(await page.locator('#task-text').inputValue(), '选图期间保留的草稿');
  assert.equal(await page.locator('#save-task').isDisabled(), true);
  await page.evaluate(() => { sessionStorage.removeItem('picking'); window.onImagesPicked(['12345678-1234-1234-1234-123456789abc.png'], '', 'result-1'); window.onImagesPicked(['12345678-1234-1234-1234-123456789abc.png'], '', 'result-1'); });
  assert.equal(await page.locator('#save-task').isEnabled(), true);
  assert.equal(await page.locator('.draft-picture').count(), 1);
  await page.locator('#save-task').click();
  await page.reload();
  assert.equal(await page.locator('#editor-layer').isVisible(), false, 'saved editor must not reappear');
  assert.equal(await page.locator('.q1 .task-title').innerText(), '选图期间保留的草稿');
  assert.equal(await page.locator('.q1 .task-images img').count(), 1);
  await page.locator('.q2 .add-button').click();
  await page.locator('#add-images').click();
  await page.evaluate(() => { sessionStorage.removeItem('picking'); window.onImagesPicked([], ''); });
  assert.equal(await page.locator('#cancel').isEnabled(), true, 'cancelling picker unblocks editor');
  await page.locator('#cancel').click();
  await page.reload();
  assert.equal(await page.locator('#editor-layer').isVisible(), false, 'cancelled editor stays closed');
  await page.evaluate(() => { localStorage.setItem('simulateReadError', 'yes'); localStorage.removeItem('native-cleaned'); });
  await page.reload();
  await page.evaluate(() => window.onImagesPicked([], '', 'result-2'));
  assert.equal(await page.evaluate(() => localStorage.getItem('native-cleaned')), null, 'read failure must never clean attachments');
  await browser.close();
  console.log('PASS: import lock; draft recovery; delayed image result; save/cancel recovery');
})().catch(error => { console.error(error); process.exit(1); });
