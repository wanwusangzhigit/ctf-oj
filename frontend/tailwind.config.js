/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // primary tokens
        paper:        'var(--paper)',
        'paper-2':    'var(--paper-2)',
        'paper-3':    'var(--paper-3)',
        ink:          'var(--ink)',
        'ink-2':      'var(--ink-2)',
        'ink-3':      'var(--ink-3)',
        rule:         'var(--rule)',
        'rule-strong':'var(--rule-strong)',
        amber:        'var(--amber)',
        'amber-hover':'var(--amber-hover)',
        'amber-soft': 'var(--amber-soft)',
        moss:         'var(--moss)',
        'moss-bg':    'var(--moss-bg)',
        oxblood:      'var(--oxblood)',
        'oxblood-bg': 'var(--oxblood-bg)',
        // legacy aliases (so older code keeps working)
        bg:            'var(--paper)',
        surface:       'var(--paper)',
        'surface-2':   'var(--paper-2)',
        border:        'var(--rule)',
        'border-strong':'var(--rule-strong)',
        fg:            'var(--ink)',
        muted:         'var(--ink-3)',
        accent:        'var(--amber)',
        'accent-fg':   '#FFFFFF',
        'accent-hover':'var(--amber-hover)',
        success:       'var(--moss)',
        'success-bg':  'var(--moss-bg)',
        warning:       'var(--amber)',
        'warning-bg':  'var(--amber-soft)',
        danger:        'var(--oxblood)',
        'danger-fg':   '#FFFFFF',
        'danger-bg':   'var(--oxblood-bg)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto',
               "'PingFang SC'", "'Hiragino Sans GB'", "'Microsoft YaHei'", 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm:   '2px',
        DEFAULT: '2px',
        md:   '3px',
        lg:   '4px',
        xl:   '6px',
        full: '9999px',
      },
      boxShadow: {
        card:    'none',
        popover: 'var(--shadow-popover)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs:   ['0.75rem',   { lineHeight: '1.05rem' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter:  '-0.025em',
      },
      maxWidth: {
        prose: '68ch',
      },
      transitionDuration: {
        120: '120ms',
      },
    },
  },
  plugins: [],
};
