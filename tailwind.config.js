/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' }
        },
        'scan-line': {
          '0%': { top: '0%' },
          '100%': { top: '100%' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'shake': 'shake 0.4s ease-in-out',
        'scan-line': 'scan-line 2s linear infinite'
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
}
