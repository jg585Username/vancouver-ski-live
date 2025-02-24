/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    'SF Pro Display',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Helvetica Neue',
                    'Helvetica',
                    'Arial',
                    'sans-serif'
                ],
            },
            colors: {
                'primary': '#007AFF',
                'secondary': '#5856D6',
                'snow-blue': 'rgba(240, 244, 248, 0.8)',
                'resort-card': 'rgba(255, 255, 255, 0.8)',
                'text': {
                    primary: '#1D1D1F',
                    secondary: '#86868B',
                    blue: '#007AFF'
                }
            },
            backdropBlur: {
                'md': '20px',
            }
        },
    },
    plugins: [],
}