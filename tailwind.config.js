/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#3D3D3D",
        brand: "#E8A44A",
        /* Google Gemini Dark design tokens */
        main: "#131314",
        surface: "#1e1f20",
        hover: "#282a2c",
        subtle: "#2d2f31",
        "accent-primary": "#a8c7fa",
        "accent-active": "#004a77",
        "accent-text": "#c2e7ff",
        "accent-text-muted": "rgba(194, 231, 255, 0.7)",
        text: "#e3e3e3",
        muted: "#8e918f",
      },
    },
  },
  plugins: [],
};
