/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'deep-navy': '#0F172A',
        'navy': '#1E293B',
        'navy-light': '#334155',
        'accent': '#3B82F6',
        'accent-dark': '#2563EB',
        'gold': '#3B82F6',
        'gold-light': '#60A5FA',
        'ink': '#1E293B',
        fl: {
          canvas: '#F9F8F5', ink: '#141614', body: '#3D3F3A', muted: '#6C7068',
          line: '#E2E1DC', surface: '#EFEEE9', card: '#FFFFFF', cream: '#F6F1E4',
          rose: '#965E6B', slate: '#5A708C', moss: '#667D63', ochre: '#94704A',
          dusk: '#7A6991', danger: '#B42318',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
        fl: ['"Zen Kaku Gothic New"', '"Hiragino Sans"', 'sans-serif'],
        book: ['"Zen Old Mincho"', '"Hiragino Mincho ProN"', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'twinkle': 'twinkle 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        twinkle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
}
