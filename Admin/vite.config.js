/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#007bff',
        'primary-dark': '#0056b3',
        'danger': '#dc3545',
        'warning': '#ffc107',
        'success': '#28a745',
        'background': '#f4f7f9',
        'card': '#ffffff',
        'text-faded': '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-danger': 'pulse-danger 2s infinite',
        'blinker': 'blinker 1s linear infinite',
      },
      keyframes: {
        'pulse-danger': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(220, 53, 69, 0.6)' },
          '50%': { boxShadow: '0 0 0 8px rgba(220, 53, 69, 0)' },
        },
        'blinker': {
          '50%': { opacity: '0.5' }
        }
      }
    },
  },
  plugins: [],
}