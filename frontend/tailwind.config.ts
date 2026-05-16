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
          ink: "#151719",
          grey: "#7e7e7e",
          muted: "#6f7680",
          line: "#e3e6ea",
          neutral: "#f2f2f2",
          canvas: "#f5f6f8"
        }
      },
      borderRadius: {
        tight: "2px",
        card: "8px",
        panel: "12px"
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(230, 0, 0, 0.16), 0 0 0 1px rgba(230, 0, 0, 0.9)",
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 16px 40px rgba(15, 23, 42, 0.06)",
        lift: "0 18px 48px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
