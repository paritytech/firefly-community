/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'Inter', 'sans-serif'],
        display: ['var(--font-display)', 'DM Serif Display', 'serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // Firefly gold accent
        'firefly-gold': 'var(--color-firefly-gold)',
        'firefly-gold-dim': 'var(--color-firefly-gold-dim)',

        // Semantic status colors
        corroborated: 'var(--fg-success)',
        challenged: 'var(--fg-error)',

        // Polkadot branding
        'polkadot-pink': 'var(--fg-polkadot-pink)',

        // Foreground colors (text)
        fg: {
          DEFAULT: 'var(--fg-default)',
          primary: 'var(--fg-primary)',
          'primary-inverted': 'var(--fg-primary-inverted)',
          secondary: 'var(--fg-secondary)',
          tertiary: 'var(--fg-tertiary)',
          muted: 'var(--fg-muted)',
          disabled: 'var(--fg-disabled)',
          inverse: 'var(--fg-inverse)',
          accent: 'var(--fg-accent)',
          success: 'var(--fg-success)',
          error: 'var(--fg-error)',
          warning: 'var(--fg-warning)',
          info: 'var(--fg-info)',
        },
      },
      backgroundColor: {
        // Surface backgrounds
        'surface-main': 'var(--bg-surface-main)',
        'surface-container': 'var(--bg-surface-container)',
        'surface-nested': 'var(--bg-surface-nested)',
        'surface-muted': 'var(--bg-surface-muted)',
        'surface-hover': 'var(--bg-surface-hover)',
        'surface-inverse': 'var(--bg-surface-inverse)',

        // Fill backgrounds
        'fill-primary': 'var(--bg-fill-primary)',
        'fill-primary-hover': 'var(--bg-fill-primary-hover)',
        'fill-secondary': 'var(--bg-fill-secondary)',
        'fill-secondary-hover': 'var(--bg-fill-secondary-hover)',
        'fill-muted': 'var(--bg-fill-muted)',
        'fill-tertiary': 'var(--bg-fill-tertiary)',

        // Button/action backgrounds
        'button-primary': 'var(--bg-button-primary)',
        'button-primary-hover': 'var(--bg-button-primary-hover)',
        'action-primary': 'var(--bg-action-primary)',
        'action-primary-hover': 'var(--bg-action-primary-hover)',
        'action-secondary': 'var(--bg-action-secondary)',
        'action-secondary-hover': 'var(--bg-action-secondary-hover)',

        // Other
        overlay: 'var(--bg-overlay)',
        'firefly-gold': 'var(--bg-accent-firefly)',
        success: 'var(--bg-success)',
        error: 'var(--bg-error)',

        // Legacy aliases
        primary: 'var(--bg-surface-main)',
        secondary: 'var(--bg-surface-container)',
        tertiary: 'var(--bg-surface-nested)',
        elevated: 'var(--bg-surface-muted)',
      },
      textColor: {
        primary: 'var(--fg-primary)',
        'primary-inverted': 'var(--fg-primary-inverted)',
        secondary: 'var(--fg-secondary)',
        tertiary: 'var(--fg-tertiary)',
        muted: 'var(--fg-muted)',
        disabled: 'var(--fg-disabled)',
        accent: 'var(--fg-accent)',
      },
      borderColor: {
        DEFAULT: 'var(--border-default)',
        subtle: 'var(--border-subtle)',
        emphasis: 'var(--border-emphasis)',
        muted: 'var(--border-muted)',
        hover: 'var(--border-hover)',
        focus: 'var(--border-focus)',
        inverse: 'var(--border-inverse)',
        accent: 'var(--border-accent)',
        error: 'var(--border-error)',
        success: 'var(--border-success)',
      },
      borderRadius: {
        small: 'var(--radius-small)',
        nested: 'var(--radius-nested)',
        container: 'var(--radius-container)',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
        focus: 'var(--shadow-focus)',
        glow: 'var(--shadow-glow)',
      },
    },
  },
  plugins: [],
};
