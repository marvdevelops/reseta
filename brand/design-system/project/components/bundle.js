/* @ds-bundle: {"format":4,"namespace":"Reseta","components":[{"name":"Button"},{"name":"StateChip"},{"name":"FieldCheck"},{"name":"ChoiceGroup"},{"name":"StepHeader"},{"name":"DoseCard"},{"name":"Notice"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  // Icons share the logo's stroke: 24 grid, 2.25 stroke, round caps and joins.
  var PATHS = {
    check: [['path', { d: 'M5 12.5l5 5L19 7' }]],
    alert: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7.5V13' }], ['circle', { cx: 12, cy: 16.6, r: 1.1, fill: 'currentColor', stroke: 'none' }]],
    stop: [['path', { d: 'M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z' }], ['path', { d: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6' }]],
    camera: [['rect', { x: 3, y: 7, width: 18, height: 13, rx: 3 }], ['path', { d: 'M8.5 7L10 4.5h4L15.5 7' }], ['circle', { cx: 12, cy: 13.5, r: 3.5 }]],
    clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3.5 2' }]],
    pill: [['rect', { x: 3.5, y: 8.5, width: 17, height: 7, rx: 3.5, transform: 'rotate(-45 12 12)' }], ['path', { d: 'M9.5 9.5l5 5' }]],
    person: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6' }]],
    speaker: [['path', { d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z' }], ['path', { d: 'M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11' }]],
    back: [['path', { d: 'M14.5 5.5L8 12l6.5 6.5' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]]
  };

  function Icon(p) {
    var size = p.size || 28;
    var parts = PATHS[p.name] || [];
    return h('svg', { className: 'rs-icon', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: p.color || 'currentColor',
      strokeWidth: 2.25, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      parts.map(function (q, i) { return h(q[0], Object.assign({ key: i }, q[1])); }));
  }

  function Button(p) {
    var variant = p.variant || 'primary', size = p.size || 'lg';
    var rest = Object.assign({}, p);
    ['variant', 'size', 'block', 'icon', 'children', 'className'].forEach(function (k) { delete rest[k]; });
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('rs-btn', 'rs-btn-' + variant, size === 'lg' && 'rs-btn-lg', p.block && 'rs-btn-block', p.className)
    }), p.icon ? h(Icon, { name: p.icon }) : null, p.children);
  }

  var STATE = {
    ok: { icon: 'check', word: 'Matches' },
    check: { icon: 'alert', word: 'Check this' },
    stop: { icon: 'stop', word: 'Ask your pharmacist' }
  };
  function StateChip(p) {
    var s = STATE[p.state] || STATE.check;
    return h('span', { className: 'rs-chip rs-chip-' + (p.state || 'check') }, h(Icon, { name: s.icon, size: 22 }), p.children || s.word);
  }

  function FieldCheck(p) {
    var state = p.state || 'check';
    return h('section', { className: cx('rs-card', !p.confirmed && state === 'stop' && 'rs-field-stop', !p.confirmed && state === 'check' && 'rs-field-check'), 'aria-label': p.label },
      h('div', { className: 'rs-field-head' }, h('span', { className: 'rs-label' }, p.label), h(StateChip, { state: p.confirmed ? 'ok' : state })),
      h('div', { className: 'rs-crop' }, p.crop ? h('img', { src: p.crop, alt: 'The handwriting for ' + p.label }) : h('span', { className: 'rs-crop-empty' }, 'Not found on the paper')),
      h('div', { className: cx('rs-value', p.mono && 'rs-value-mono') }, p.value || '—'),
      p.reason ? h('p', { className: 'rs-reason' }, p.reason) : null,
      p.confirmed
        ? h('div', { className: 'rs-actions' },
            h('div', { className: 'rs-done' }, h(Icon, { name: 'check' }), 'You checked this'),
            h(Button, { variant: 'quiet', size: 'md', onClick: p.onChange }, 'Change'))
        : h('div', { className: 'rs-actions' },
            state === 'stop'
              ? h(Button, { variant: 'secondary', block: true, onClick: p.onChange }, 'Type it from the label')
              : h(Button, { variant: 'secondary', block: true, icon: 'check', onClick: p.onMatch }, 'Matches the paper'),
            state === 'stop' ? null : h(Button, { variant: 'quiet', size: 'md', onClick: p.onChange }, 'It’s different, change it')));
  }

  function ChoiceGroup(p) {
    return h('fieldset', { className: 'rs-choices', role: 'radiogroup' },
      p.label ? h('legend', null, p.label) : null,
      (p.options || []).map(function (o) {
        var on = o.value === p.value;
        return h('button', { key: o.value, type: 'button', role: 'radio', 'aria-checked': on, className: 'rs-choice',
            onClick: function () { p.onChange && p.onChange(o.value); } },
          h('span', { className: 'rs-choice-dot' }, on ? h(Icon, { name: 'check', size: 20 }) : null),
          h('span', { className: 'rs-choice-text' }, h('span', { className: 'rs-choice-label' }, o.label), o.hint ? h('span', { className: 'rs-choice-hint' }, o.hint) : null));
      }));
  }

  function StepHeader(p) {
    var dots = [];
    for (var i = 1; i <= p.total; i++) dots.push(h('span', { key: i, className: cx('rs-step-dot', i <= p.step && 'rs-step-dot-on') }));
    return h('header', { className: 'rs-step' },
      h('div', { className: 'rs-step-bar' },
        p.onBack ? h(Button, { variant: 'quiet', size: 'md', icon: 'back', onClick: p.onBack }, 'Back') : h('span'),
        h('span', { className: 'rs-step-count' }, 'Step ' + p.step + ' of ' + p.total)),
      h('div', { className: 'rs-step-dots', 'aria-hidden': true }, dots),
      h('h1', { className: 'rs-step-title' }, p.title));
  }

  function DoseCard(p) {
    return h('section', { className: 'rs-card', 'aria-label': 'Medicine for ' + p.person },
      h('div', { className: 'rs-dose-top' },
        h('div', null, h('p', { className: 'rs-dose-who' }, 'For ' + p.person), h('div', { className: 'rs-dose-time' }, p.time)),
        p.photo ? h('img', { className: 'rs-dose-photo', src: p.photo, alt: 'Photo of the medicine' }) : h('div', { className: 'rs-dose-photo' }, h(Icon, { name: 'pill', size: 40 }))),
      h('div', { className: 'rs-dose-med' }, p.medicine),
      h('p', { className: 'rs-dose-how' }, p.amount + (p.instruction ? ', ' + p.instruction : '')),
      h(Button, { variant: 'primary', block: true, icon: 'check', onClick: p.onTaken }, 'I took it'),
      h(Button, { variant: 'secondary', block: true, size: 'md', icon: 'clock', onClick: p.onSnooze }, 'Remind me in 10 minutes'),
      h('div', { className: 'rs-field-head' },
        h(Button, { variant: 'quiet', size: 'md', onClick: p.onSkip }, 'Skip this dose'),
        h(Button, { variant: 'quiet', size: 'md', icon: 'speaker', onClick: p.onSpeak }, 'Read aloud')));
  }

  var NOTICE_ICON = { info: 'alert', look: 'alert', stop: 'stop' };
  function Notice(p) {
    var tone = p.tone || 'info';
    return h('div', { className: 'rs-notice rs-notice-' + tone, role: tone === 'stop' ? 'alert' : 'status' },
      h(Icon, { name: NOTICE_ICON[tone] }),
      h('div', null, p.title ? h('p', { className: 'rs-notice-title' }, p.title) : null, h('p', { className: 'rs-notice-body' }, p.children)));
  }

  window.Reseta = Object.assign(window.Reseta || {}, { Button: Button, StateChip: StateChip, FieldCheck: FieldCheck, ChoiceGroup: ChoiceGroup,
    StepHeader: StepHeader, DoseCard: DoseCard, Notice: Notice, Icon: Icon });
})();
