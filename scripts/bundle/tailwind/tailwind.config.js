/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../../../web/templates/**/*.html",
    "../../../web/static/js/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // UI font - used for interface elements (buttons, headers, labels, etc.)
        sans: [
            '-apple-system',
            'BlinkMacSystemFont', '"Segoe UI"',
            'Roboto',
            'Helvetica',
            'Arial',
            'sans-serif',
            '"Apple Color Emoji"',
            '"Segoe UI Emoji"',
            '"Segoe UI Symbol"'
        ],
        content: [
            '"Libre Franklin"',
            '-apple-system',
            'BlinkMacSystemFont', '"Segoe UI"',
            'Roboto',
            'Helvetica',
            'Arial',
            'sans-serif',
            '"Apple Color Emoji"',
            '"Segoe UI Emoji"',
            '"Segoe UI Symbol"'

        ],
      },
    },
  },
  plugins: [],
}