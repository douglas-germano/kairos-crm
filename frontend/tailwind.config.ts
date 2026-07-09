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
        // shadcn CSS variable tokens (ver app/globals.css)
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
        // ── Paleta da marca — sistema "Kairos Light": claro, minimalista, violeta sóbrio.
        // As chaves (red/redDark/red50…charcoal/ink/canvas/white) são mantidas por
        // compatibilidade com as classes usadas em toda a UI; os valores agora são
        // do tema claro. "red*" = o accent violeta; "canvas" = fundo do app;
        // "white" = superfície de cartão; "ink" = texto forte; "charcoal" = superfície
        // escura (tooltip/chip escuro) e também texto forte.
        brand: {
          red: "#6e56cf",         // accent primário (violeta sóbrio)
          redDark: "#5b47b8",     // accent hover
          red50: "#f4f2fb",       // accent — fundo suave
          red100: "#e9e4f8",      // accent — fundo suave (mais forte)
          red200: "#d7cef1",      // accent — borda suave
          ink: "#18161f",         // títulos / texto forte
          charcoal: "#2a2833",    // superfície escura + texto forte
          grey: "#8a8792",        // texto terciário / ícones neutros
          muted: "#6b6975",       // texto secundário / meta (AA sobre canvas)
          faint: "#9895a2",       // desabilitado
          line: "#eae9f0",        // hairline / bordas
          lineStrong: "#dcdae4",  // borda mais evidente
          neutral: "#eeedf3",     // preenchimento neutro (skeleton/hover)
          canvas: "#f6f6f9",      // fundo do app
          panel: "#ffffff",       // painel
          white: "#ffffff",       // superfície de cartão
          success: "#16a34a",
          successStrong: "#15803d",
          successSoft: "#e8f6ee",
          warning: "#c2760b",
          warningStrong: "#a1620a",
          warningSoft: "#fbf1df",
          info: "#2563eb",
          infoStrong: "#1d4ed8",
          infoSoft: "#e9f0fe",
          danger: "#dc2626",
          dangerSoft: "#fdeceb",
          // accent secundário e frio — usados só como tinta de ícone nos nodes do fluxo
          highlight: "#8b5cf6",
          highlightSoft: "#f1ecfd",
          cyan: "#0891b2",
          cyanSoft: "#e2f4f8"
        },
        // Escala vermelha padrão do Tailwind — reservada a estados de erro/perigo
        // (bg-red-50 / border-red-200 / text-red-600), desacoplada do accent violeta.
        red: {
          50: "#fdeceb",
          100: "#fbdad8",
          200: "#f5c3c0",
          300: "#ee9d99",
          600: "#dc2626",
          700: "#b91c1c"
        }
      },
      fontFamily: {
        // UI + títulos em Inter — sistema minimalista, uma família só (ver app/layout.tsx).
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        tight: "6px",
        card: "var(--r-card)",
        panel: "var(--r-panel)",
        pill: "var(--r-pill)"
      },
      borderWidth: {
        control: "1px"
      },
      boxShadow: {
        // Elevação sutil (não neon) — a "profundidade" do tema claro vem de bordas
        // finas + sombras muito suaves, quase imperceptíveis.
        xs: "0 1px 2px rgba(24,22,34,0.05)",
        sm: "0 1px 2px rgba(24,22,34,0.05), 0 1px 3px rgba(24,22,34,0.05)",
        md: "0 2px 4px rgba(24,22,34,0.04), 0 4px 12px rgba(24,22,34,0.07)",
        lg: "0 12px 32px -12px rgba(24,22,34,0.16)",
        overlay: "0 8px 32px -8px rgba(24,22,34,0.18), 0 2px 8px rgba(24,22,34,0.08)",
        // sombra com leve tinta do accent, só no hover do botão primário
        glow: "0 4px 14px -4px rgba(110,86,207,0.35)",
        "glow-lg": "0 12px 30px -10px rgba(110,86,207,0.32)"
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
