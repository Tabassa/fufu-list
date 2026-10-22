/* Deterministic, offline Chinese deadline recognition. All dates use the device's local calendar. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FufuDeadline = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const digits = '零一二三四五六七八九', number = '[0-9零〇一二两三四五六七八九十]+';
  const datePattern = new RegExp('大后天|后天|明天|今天|(?:下下|下|本|这)?(?:周|星期|礼拜)[一二三四五六日天1-7]|(?:[0-9零〇一二三四五六七八九]{4}年)?' + number + '月' + number + '[日号]|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}', 'g');
  const timePattern = new RegExp('(' + number + ')\\s*(?::\\s*(' + number + ')|[点时](?:\\s*(半|一刻|三刻)|\\s*(' + number + ')\\s*分?)?)', 'g');
  const periodPattern = /凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里/g;
  const defaults = {'凌晨': 0, '早上': 9, '早晨': 9, '上午': 9, '中午': 12, '下午': 15, '傍晚': 18, '晚上': 20, '夜里': 20};
  const pad = value => String(value).padStart(2, '0');
  const dayString = date => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  function integer(value) {
    if (/^\d+$/.test(value)) return Number(value);
    const text = value.replace(/〇/g, '零').replace(/两/g, '二');
    if (!text.includes('十')) return Number(Array.from(text, char => digits.indexOf(char)).join(''));
    const parts = /^([一二三四五六七八九])?十([一二三四五六七八九])?$/.exec(text);
    return parts ? (parts[1] ? digits.indexOf(parts[1]) : 1) * 10 + (parts[2] ? digits.indexOf(parts[2]) : 0) : NaN;
  }
  function parseDeadline(input, now = new Date()) {
    const text = String(input).normalize('NFKC').replace(/明早/g, '明天早上').replace(/明晚/g, '明天晚上').replace(/今晚/g, '今天晚上').replace(/今早/g, '今天早上');
    const dates = Array.from(text.matchAll(datePattern)).filter(match => !/^[次遍]/.test(text.slice(match.index + match[0].length)));
    // Removing the date first prevents “下周五十三点” from treating “五十三” as the hour.
    const rest = text.replace(datePattern, ' '), periods = Array.from(rest.matchAll(periodPattern));
    const times = Array.from(rest.matchAll(timePattern)).filter(match => {
      const barePoint = !match[2] && !match[3] && !match[4] && match[0].endsWith('点');
      const afterPeriod = periods.some(period => /^\s*$/.test(rest.slice(period.index + period[0].length, match.index)) && period.index < match.index);
      return !barePoint || afterPeriod || !/^(?:点|建议|意见|要求|原因|问题)/.test(rest.slice(match.index + match[0].length));
    });
    if (!dates.length && !times.length && !periods.length) return null;
    const unclear = {error: '时间表述不明确，请手动选择截止日期'};
    if (dates.length > 1 || times.length > 1 || periods.length > 1 || /(?:不是|不要|别在|并非|取消).{0,4}(?:今天|明天|后天|周|星期|礼拜|上午|中午|下午|晚上|\d+[点时])/.test(text.replace(/不要忘记|不要忘了|别忘记|别忘了/g, ''))) return unclear;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    if (dates.length) {
      const phrase = dates[0][0], relative = ['今天', '明天', '后天', '大后天'].indexOf(phrase);
      const week = /^(下下|下|本|这)?(?:周|星期|礼拜)([一二三四五六日天1-7])$/.exec(phrase);
      if (relative >= 0) date.setDate(date.getDate() + relative);
      else if (week) {
        const target = /[日天]/.test(week[2]) ? 6 : (/\d/.test(week[2]) ? Number(week[2]) : digits.indexOf(week[2])) - 1;
        const weekday = (date.getDay() + 6) % 7, weeks = week[1] === '下下' ? 2 : week[1] === '下' ? 1 : 0;
        let offset = target - weekday + weeks * 7;
        if (!week[1] && offset < 0) offset += 7;
        date.setDate(date.getDate() + offset);
      } else {
        const parts = phrase.includes('月') ? /^(?:(.+)年)?(.+)月(.+)[日号]$/.exec(phrase) : /^(\d{4})-(\d+)-(\d+)$/.exec(phrase);
        let year = parts[1] ? integer(parts[1]) : now.getFullYear();
        const month = integer(parts[2]), day = integer(parts[3]);
        date.setFullYear(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return {error: '日期无效，请手动选择截止日期'};
        if (!parts[1] && dayString(date) < dayString(now)) {
          date.setFullYear(++year);
          if (date.getMonth() !== month - 1 || date.getDate() !== day) return unclear;
        }
      }
    }
    let time = '';
    if (times.length || periods.length) {
      const period = periods.length ? periods[0][0] : '';
      const bareHour = period && new RegExp(period + '\\s*(' + number + ')(?![0-9零〇一二两三四五六七八九十])').exec(rest);
      const match = times[0] || (bareHour && !/^[个本件次节]/.test(rest.slice(bareHour.index + bareHour[0].length)) ? [bareHour[0], bareHour[1]] : null);
      let hour = match ? integer(match[1]) : defaults[period];
      const minute = !match ? 0 : match[3] ? {'半': 30, '一刻': 15, '三刻': 45}[match[3]] : integer(match[2] || match[4] || '0');
      if (hour > 23 || minute > 59 || !Number.isInteger(hour) || !Number.isInteger(minute)) return {error: '时间无效，请手动选择截止日期'};
      if (period && match) {
        if (['晚上', '夜里'].includes(period) && hour === 12) { hour = 0; date.setDate(date.getDate() + 1); }
        else {
          if (['下午', '傍晚', '晚上', '夜里'].includes(period) && hour < 12) hour += 12;
          if (period === '中午' && hour >= 1 && hour <= 10) hour += 12;
          if (period === '凌晨' && hour === 12) hour = 0;
        }
      }
      time = pad(hour) + ':' + pad(minute);
    }
    return {due: dayString(date), time};
  }
  return {parseDeadline};
});
