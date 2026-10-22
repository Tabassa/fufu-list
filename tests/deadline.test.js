const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const file = require('node:path').resolve(__dirname, '../assets/deadline.js');
const now = new Date(2026, 9, 22, 16, 40);
function parse(text, date = now) {
  assert.ok(fs.existsSync(file), 'offline deadline parser exists');
  return require(file).parseDeadline(text, date);
}

test('Chinese and Arabic weekdays/hours can be mixed directly in task text', () => {
  for (const text of ['下周五十三点做班务作业', '下周5 13点做班务作业', '下星期五13:00交作业', '下礼拜５１３：００交作业']) {
    assert.deepEqual(parse(text), {due: '2026-10-30', time: '13:00'}, text);
  }
  for (const text of ['周六买书', '周6买书', '星期六买书', '星期6买书']) {
    assert.deepEqual(parse(text), {due: '2026-10-24', time: ''}, text);
  }
});
test('relative days and periods use the phone calendar date, including past times today', () => {
  const examples = {'明天下午两点开会': ['2026-10-23', '14:00'], '中午吃饭': ['2026-10-22', '12:00'],
    '下午交作业': ['2026-10-22', '15:00'], '后天上午九点半上课': ['2026-10-24', '09:30'],
    '明晚八点看电影': ['2026-10-23', '20:00'], '今天23点59分提交': ['2026-10-22', '23:59'],
    '明天交报告': ['2026-10-23', ''], '今晚十二点休息': ['2026-10-23', '00:00'],
    '不要忘记明天下午两点开会': ['2026-10-23', '14:00'], '今天上午十二点开会': ['2026-10-22', '12:00'],
    '明晚十二点提交': ['2026-10-24', '00:00'], '下午16提交': ['2026-10-22', '16:00'], '中午13交报告': ['2026-10-22', '13:00']};
  for (const [text, [due, time]] of Object.entries(examples)) assert.deepEqual(parse(text), {due, time}, text);
});
test('minute expressions and 24-hour notation do not need an AI service', () => {
  for (const [text, time] of [['下午2点15分', '14:15'], ['下午两点十五分', '14:15'], ['十三点零五分', '13:05'],
    ['18点30提交', '18:30'], ['晚上八点一刻', '20:15'], ['上午十一点三刻', '11:45'], ['０８：０５出门', '08:05'],
    ['下午两点半需要交报告', '14:30'], ['14:30需要提交', '14:30'], ['下午2点15分需要提交', '14:15']]) {
    assert.deepEqual(parse(text), {due: '2026-10-22', time}, text);
  }
});
test('next week is a Monday-based calendar week, with year/month boundaries', () => {
  assert.deepEqual(parse('下周一交报告', new Date(2026, 9, 25, 23, 59)), {due: '2026-10-26', time: ''});
  assert.deepEqual(parse('下周日交报告', new Date(2026, 9, 25)), {due: '2026-11-01', time: ''});
  assert.deepEqual(parse('下周五十三点', new Date(2026, 11, 31)), {due: '2027-01-08', time: '13:00'});
  assert.deepEqual(parse('明天下午两点', new Date(2026, 11, 31, 23, 59)), {due: '2027-01-01', time: '14:00'});
  assert.deepEqual(parse('周四交作业'), {due: '2026-10-22', time: ''});
});
test('explicit month/day dates accept Chinese and Arabic numerals', () => {
  for (const text of ['十月三十日十三点', '10月30号13:00', '2026年十月三十日下午1点', '2026-10-30 13:00']) {
    assert.deepEqual(parse(text), {due: '2026-10-30', time: '13:00'}, text);
  }
  assert.deepEqual(parse('1月2日提交'), {due: '2027-01-02', time: ''});
});
test('ordinary numbers are untouched; conflicting dates and invalid times are not guessed', () => {
  for (const text of ['完成第13题，买6本书', '学习C++，得分13.5', '以后买鞋', '周末作业', '一周五次跑步', '写五点建议', '想想还有几点问题', '提前一个小时']) assert.equal(parse(text), null, text);
  for (const text of ['明天下午25点开会', '下午两点70分', '明天和后天交作业', '明天14:00到16:00开会',
    '2026年2月30日交作业', '不是明天交作业', '明天不要下午两点']) assert.ok(parse(text)?.error, text);
});
