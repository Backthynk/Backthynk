/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../../../web/templates/**/*.html",
    "../../../web/static/js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        // UI font - used for interface elements (buttons, headers, labels, etc.)
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"'
        ],
        // Content font - used for post content and dynamic text
        content: [
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif'
        ],
      },
    },
  },
  plugins: [],
}