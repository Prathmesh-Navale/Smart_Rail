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
      'siri-pulse': 'siri-pulse 2s infinite',
    },
    keyframes: {
      'siri-pulse': {
        '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(0, 123, 255, 0.7)' },
        '70%': { transform: 'scale(1.1)', boxShadow: '0 0 0 20px rgba(0, 123, 255, 0)' },
        '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(0, 123, 255, 0)' },
      }
    }
    },
  },
  plugins: [],
}