// tailwind.config.js - Create this file in your WebApp/ root directory
module.exports = {
    content: [
        "./app/templates/**/*.html",
        "./app/static/js/**/*.js",
        "./app/static/**/*.html"
    ],
    theme: {
        extend: {
        colors: {
            // Your custom molecular dynamics color palette
            'molecular': {
            'black': '#000000',
            'charcoal': '#363946', 
            'gray': '#696773',
            'sage': '#819595',
            'sage-light': '#B1B6A6'
            },
            // Additional scientific/data visualization colors
            'data': {
            's1': '#dc3545',     // Red for S1 transitions
            's2': '#28a745',     // Green for S2 transitions
            'spectrum': '#667eea', // Blue for spectrum
            'energy': '#ff6b6b'   // Red for energy markers
            }
        },
        fontFamily: {
            'sans': ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace']
        },
        animation: {
            'fade-in': 'fadeIn 0.3s ease-in-out',
            'slide-up': 'slideUp 0.3s ease-out',
            'pulse-slow': 'pulse 3s infinite',
            'spin-slow': 'spin 3s linear infinite'
        },
        keyframes: {
            fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' }
            },
            slideUp: {
            '0%': { transform: 'translateY(10px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' }
            }
        },
        boxShadow: {
            'molecular': '0 4px 6px -1px rgba(54, 57, 70, 0.1), 0 2px 4px -1px rgba(54, 57, 70, 0.06)',
            'chart': '0 10px 15px -3px rgba(54, 57, 70, 0.1), 0 4px 6px -2px rgba(54, 57, 70, 0.05)',
            'popup': '0 20px 25px -5px rgba(54, 57, 70, 0.1), 0 10px 10px -5px rgba(54, 57, 70, 0.04)'
        },
        backdropBlur: {
            'xs': '2px'
        }
        }
    },
    plugins: []
}