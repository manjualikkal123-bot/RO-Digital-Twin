/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'brand-dark': '#070F1E',
        'brand-panel': '#101B2D',
        'brand-accent': '#00F0FF',
        'brand-purple': '#B465FF',
        'theme-main': 'var(--bg-main)',
        'theme-panel': 'var(--bg-panel)',
        'theme-text': 'var(--text-main)',
        'theme-muted': 'var(--text-muted)',
        'theme-border': 'var(--border-panel)',
        'theme-accent': 'var(--accent)',
        'brand-navy': '#0B1120',
        'brand-slate': '#1E293B',
        'brand-cyan': '#2DD4BF', // Permionics style teal/cyan
        'brand-blue': '#3B82F6',
        'brand-amber': '#F59E0B',
        'brand-red': '#EF4444',
        'brand-green': '#10B981'
      }
    },
  },
  plugins: [],
}
