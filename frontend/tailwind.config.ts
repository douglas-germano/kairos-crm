import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#e60000",
          redDark: "#ac1811",
          charcoal: "#25282b",
          grey: "#7e7e7e",
          neutral: "#f2f2f2"
        }
      },
      borderRadius: {
        tight: "2px",
        card: "6px"
      },
      boxShadow: {
        focus: "inset 0 0 0 1px rgba(230, 0, 0, 0.55)"
      }
    }
  },
  plugins: []
};

export default config;
