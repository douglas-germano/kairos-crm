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
        // brand palette — reskin "Leona Flow" (violeta/magenta/ciano, dark glass).
        // Nomes de chave mantidos (red/redDark/red50…) por compatibilidade com as
        // classes já usadas em toda a UI; os valores agora são a paleta violeta.
        brand: {
          red: "#7c3aed",
          redDark: "#6d28d9",
          red50: "#1f1533",
          red100: "#2a1c47",
          red200: "#4c3380",
          charcoal: "#e3ddf0",
          ink: "#f5f3fa",
          grey: "#a99fc4",
          muted: "#9a8fb8", // ~7:1 sobre --canvas — AA confortável em texto pequeno no tema escuro
          line: "#2c2440",
          lineStrong: "#3d3153",
          neutral: "#1b1726",
          canvas: "#0a0812",
          panel: "#15111f",
          white: "#1c1729",
          success: "#34d399",
          successStrong: "#10b981",
          successSoft: "#0f2e22",
          warning: "#fbbf24",
          warningStrong: "#f59e0b",
          warningSoft: "#3a2c0d",
          info: "#38bdf8",
          infoStrong: "#0ea5e9",
          infoSoft: "#0d2b3a",
          danger: "#f87171",
          dangerSoft: "#2a1414",
          // novos tokens do reskin — sem equivalente no sistema Vodafone anterior
          highlight: "#d946ef",
          highlightSoft: "#33123a",
          cyan: "#22d3ee",
          cyanSoft: "#0d2f36"
        },
        // Override da escala vermelha padrão do Tailwind — usada hoje só em
        // banners de erro (bg-red-50/border-red-200/text-red-600); vira o
        // "danger" real, desacoplado do brand.red (que agora é violeta).
        red: {
          50: "#2a1414",
          100: "#3a1a1a",
          200: "#5c2626",
          300: "#7a2f2f",
          600: "#f87171",
          700: "#fca5a5"
        }
      },
      fontFamily: {
        // Corpo/UI em Inter; títulos em Space Grotesk — ver app/layout.tsx.
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
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
