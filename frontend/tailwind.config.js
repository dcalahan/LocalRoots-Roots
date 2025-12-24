/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Local Roots brand colors
        'roots-primary': '#EB6851',      // RGB 235, 104, 81
        'roots-secondary': '#3EBFAC',    // RGB 62, 191, 172
        'roots-gray': '#818181',         // RGB 129, 129, 129
        'roots-cream': '#F5F0EE',        // RGB 245, 240, 238
      },
      fontFamily: {
        heading: ['Chaparral Pro', 'Georgia', 'serif'],
        body: ['Avenir', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
