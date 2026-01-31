/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			"neutral-gray": {
  				50: "#f8fafc",
  				100: "#f1f5f9",
  				200: "#e2e8f0",
  				300: "#cbd5e1",
  				400: "#94a3b8",
  				500: "#64748b",
  				600: "#475569",
  				700: "#334155",
  				800: "#1e293b",
  				900: "#0f172a",
  				950: "#020617",
  			},
  			"accent-cyan": "#22d3ee",
  		},
  		fontFamily: {
  			sans: ["Inter", "sans-serif"],
  			mono: ["JetBrains Mono", "monospace"],
  		},
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

