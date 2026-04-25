import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        kidgo: {
          50: "#EFF8F6",
          100: "#D5EDE9",
          200: "#AEDBD4",
          300: "#7CCBB9",
          400: "#5BBAA7",
          500: "#4A9E8E",
          600: "#3A8275",
          700: "#2E6860",
          800: "#245350",
          900: "#1C4340",
          cream: "#F5F0E8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
