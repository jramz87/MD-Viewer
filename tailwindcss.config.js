module.exports = {
    content: [
        "./app/templates/**/*.html",
        "./app/static/js/**/*.js"
    ],
    theme: {
        extend: {
        colors: {
            'molecular': {
            'black': '#000000',
            'charcoal': '#363946', 
            'gray': '#696773',
            'sage': '#819595',
            'sage-light': '#B1B6A6'
            },
            'data': {
            's1': '#dc3545',
            's2': '#28a745',
            'spectrum': '#667eea',
            'energy': '#ff6b6b'
            }
        }
        }
    },
    plugins: []
}