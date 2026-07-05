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
        // shadcn CSS variable tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))"
        },
        // brand palette
        brand: {
          red: "#e60000",
          redDark: "#ac1811",
          red50: "#fef2f2",
          red100: "#fee2e2",
          red200: "#fecaca",
          charcoal: "#25282b",
          ink: "#151719",
          grey: "#7e7e7e",
          muted: "#63697a", // 5.5:1 on white — margem segura acima do mínimo AA (4.5:1) para texto pequeno
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
        // Fonte única (Inter) — ver "Note on Font Substitutes" em prompt/design-system.md §3.
        sans: ["var(--font-sans)"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Vodafone-inspired scale: 2px sharp utility controls, 6px cards/containers,
        // 32px filled badge pills, 60px editorial CTA pills, 50%/100% circles/portraits
        tight: "2px",
        card: "6px",
        panel: "6px",
        pill: "32px"
      },
      borderWidth: {
        control: "1px"
      },
      boxShadow: {
        // Flat system — the only permitted "elevation" is a crisp focus ring.
        // No card/lift/sidebar/node shadows: surface color and 1px borders carry hierarchy.
        focus: "0 0 0 2px rgba(230, 0, 0, 0.35), inset 0 0 0 1px #e60000"
      },
      transitionTimingFunction: {
        brand: "var(--ease-out-expo)"
      },
      transitionDuration: {
        fast: "var(--t-fast)",
        base: "var(--t-base)",
        slow: "var(--t-slow)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
