module.exports = {
    content: [
        "./app/templates/**/*.html",
        "./app/static/js/**/*.js",
        "./app/static/**/*.html"
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
                }
            }
        }
    },
    plugins: []
}