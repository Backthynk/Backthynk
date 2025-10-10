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
          '"Mona Sans"',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"'
        ],
        // Content font - used for post content and dynamic text
        content: [
          '"Mona Sans"',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"'
        ],
      },
    },
  },
  plugins: [],
}