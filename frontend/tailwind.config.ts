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
          red50: "#fef2f2",
          red100: "#fee2e2",
          red200: "#fecaca",
          charcoal: "#25282b",
          ink: "#151719",
          grey: "#7e7e7e",
          muted: "#6f7680",
          line: "#e3e6ea",
          neutral: "#f2f2f2",
          canvas: "#f5f6f8",
          panel: "#fbfcfd",
          white: "#ffffff",
          success: "#00a651",
          successStrong: "#008f44",
          successSoft: "#d9f7e3",
          warning: "#f5a623",
          warningStrong: "#d18910",
          warningSoft: "#ffeccb",
          info: "#1565d8",
          infoStrong: "#0d4ea9",
          infoSoft: "#d6e7ff",
          danger: "#e60000",
          dangerSoft: "#ffe1e1"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        condensed: ["var(--font-condensed)"],
        serif: ["var(--font-serif)"]
      },
      borderRadius: {
        tight: "2px",
        card: "8px",
        panel: "12px",
        pill: "32px"
      },
      borderWidth: {
        control: "1.5px"
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(230, 0, 0, 0.16), 0 0 0 1px rgba(230, 0, 0, 0.9)",
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 16px 40px rgba(15, 23, 42, 0.06)",
        lift: "0 18px 48px rgba(15, 23, 42, 0.12)",
        sidebar: "8px 0 30px rgba(15, 23, 42, 0.04)",
        node: "0 10px 28px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
