// Every colour is a Furrow token (src/renderer/src/styles/tokens.css), mixed for opacity modifiers.
const token = (name) => `color-mix(in oklab, var(${name}) calc(<alpha-value> * 100%), transparent)`

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-outlier)']
      },
      letterSpacing: {
        display: 'var(--tracking-display)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: 'var(--radius-card)',
        entry: 'var(--radius-entry)',
        key: 'var(--radius-pill)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        key: 'var(--shadow-key)',
        'key-primary': 'var(--shadow-key-primary)'
      },
      transitionDuration: {
        micro: 'var(--dur-micro)',
        short: 'var(--dur-short)'
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)'
      },
      // A short bar that slides across the track while the progress is unknown.
      keyframes: {
        indeterminate: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(250%)' }
        }
      },
      animation: {
        indeterminate: 'indeterminate 1.4s ease-in-out infinite'
      },
      colors: {
        background: token('--background'),
        foreground: token('--foreground'),
        card: {
          DEFAULT: token('--card'),
          foreground: token('--card-foreground')
        },
        popover: {
          DEFAULT: token('--popover'),
          foreground: token('--popover-foreground')
        },
        primary: {
          DEFAULT: token('--primary'),
          foreground: token('--primary-foreground')
        },
        secondary: {
          DEFAULT: token('--secondary'),
          foreground: token('--secondary-foreground')
        },
        muted: {
          DEFAULT: token('--muted'),
          foreground: token('--muted-foreground')
        },
        accent: {
          DEFAULT: token('--accent'),
          foreground: token('--accent-foreground')
        },
        destructive: {
          DEFAULT: token('--destructive'),
          foreground: token('--destructive-foreground')
        },
        border: token('--border'),
        input: token('--input'),
        ring: token('--ring'),
        paper: {
          DEFAULT: token('--color-paper'),
          2: token('--color-paper-2'),
          3: token('--color-paper-3')
        },
        sheet: token('--color-sheet'),
        ink: {
          DEFAULT: token('--color-ink'),
          2: token('--color-ink-2')
        },
        rule: token('--color-rule'),
        action: {
          DEFAULT: token('--color-action'),
          ink: token('--color-action-ink'),
          edge: token('--color-action-edge')
        },
        signal: {
          DEFAULT: token('--color-accent'),
          ink: token('--color-accent-ink'),
          soft: token('--color-accent-soft'),
          edge: token('--color-accent-edge')
        },
        green: {
          DEFAULT: token('--color-green'),
          soft: token('--color-green-soft')
        },
        danger: {
          DEFAULT: token('--color-error'),
          soft: token('--color-error-soft')
        },
        head: {
          DEFAULT: token('--color-head'),
          ink: token('--color-head-ink')
        },
        scrim: 'var(--color-scrim)'
      }
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('tailwindcss-animate')]
}
