(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  let year, month, selected, callback;
  const iso = (y, m, d) => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  function render() {
    $('#calendar-caption').textContent = year + '年' + (month + 1) + '月';
    const days = $('#calendar-days'); days.replaceChildren();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const now = new Date(), today = iso(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < offset; i++) days.appendChild(document.createElement('span'));
    for (let day = 1; day <= total; day++) {
      const date = iso(year, month, day), button = document.createElement('button');
      button.type = 'button'; button.textContent = day; button.dataset.day = date;
      button.className = (date === selected ? 'selected ' : '') + (date === today ? 'today' : '');
      button.setAttribute('aria-label', year + '年' + (month + 1) + '月' + day + '日');
      button.setAttribute('aria-pressed', String(date === selected));
      button.addEventListener('click', () => { selected = date; render(); }); days.appendChild(button);
    }
  }
  function close() { const open = !$('#calendar-layer').hidden; $('#calendar-layer').hidden = true; return open; }
  window.FufuCalendar = {
    open(date, time, done) {
      const now = new Date(); selected = date || iso(now.getFullYear(), now.getMonth(), now.getDate());
      [year, month] = selected.split('-').map(Number); month--; callback = done;
      $('#calendar-time').value = time || ''; $('#calendar-layer').hidden = false; render();
    }, close
  };
  $('#previous-month').addEventListener('click', () => { month--; if (month < 0) { year--; month = 11; } render(); });
  $('#next-month').addEventListener('click', () => { month++; if (month > 11) { year++; month = 0; } render(); });
  $('#calendar-cancel').addEventListener('click', close);
  $('#calendar-confirm').addEventListener('click', () => { callback(selected, $('#calendar-time').value); close(); });
  $('#clear-time').addEventListener('click', () => { $('#calendar-time').value = ''; });
  $('#calendar-layer').addEventListener('click', e => { if (e.target === $('#calendar-layer')) close(); });
})();
