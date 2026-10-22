(function () {
  'use strict';
  const $ = s => document.querySelector(s), height = 48;
  let columns = [], callback;
  function makeWheel(id, count, selected) {
    const element = $(id), column = {element, count, current: null, timer: null};
    element.replaceChildren();
    for (let i = 0; i < count * 3; i++) {
      const option = document.createElement('button');
      option.type = 'button'; option.dataset.value = i % count; option.tabIndex = -1;
      option.textContent = String(i % count).padStart(2, '0'); option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      option.addEventListener('click', () => { element.scrollTop = i * height; mark(); });
      element.appendChild(option);
    }
    function mark() {
      const index = Math.max(0, Math.min(count * 3 - 1, Math.round(element.scrollTop / height)));
      if (column.current !== index) {
        if (column.current !== null) element.children[column.current].setAttribute('aria-selected', 'false');
        element.children[index].setAttribute('aria-selected', 'true'); column.current = index;
      }
      return index;
    }
    element.onscroll = () => {
      mark(); clearTimeout(column.timer);
      column.timer = setTimeout(() => {
        const index = mark();
        if (index < count / 2 || index >= count * 2.5) { element.scrollTop = (count + index % count) * height; mark(); }
      }, 120);
    };
    element.scrollTop = (count + selected) * height; mark();
    column.value = () => String(mark() % count).padStart(2, '0');
    return column;
  }
  function close() {
    const open = !$('#time-layer').hidden;
    $('#time-layer').hidden = true; columns.forEach(column => clearTimeout(column.timer));
    return open;
  }
  window.FufuTime = {
    open(value, done) {
      callback = done; const now = new Date();
      const parts = value ? value.split(':').map(Number) : [now.getHours(), now.getMinutes()];
      $('#time-layer').hidden = false;
      columns = [makeWheel('#hour-wheel', 24, parts[0]), makeWheel('#minute-wheel', 60, parts[1])];
    }, close
  };
  $('#time-cancel').addEventListener('click', close);
  $('#time-confirm').addEventListener('click', () => { callback(columns.map(column => column.value()).join(':')); close(); });
  $('#time-clear').addEventListener('click', () => { callback(''); close(); });
  $('#time-layer').addEventListener('click', e => { if (e.target === $('#time-layer')) close(); });
})();
