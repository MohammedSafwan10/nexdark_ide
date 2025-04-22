import scrollbarPlugin from 'tailwind-scrollbar'; // Import the plugin

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./electron/**/*.{js,ts,jsx,tsx}", // Include electron directory if relevant
  ],
  theme: {
    extend: {},
  },
  plugins: [
    scrollbarPlugin, // Use the imported plugin
  ],
} 