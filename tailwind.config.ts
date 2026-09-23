import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1480px"
      }
    },
    extend: {
      colors: {
        background: "hsl(var(--ui-background))",
        foreground: "hsl(var(--ui-foreground))",
        card: {
          DEFAULT: "hsl(var(--ui-card))",
          foreground: "hsl(var(--ui-card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--ui-popover))",
          foreground: "hsl(var(--ui-popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--ui-primary))",
          foreground: "hsl(var(--ui-primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--ui-secondary))",
          foreground: "hsl(var(--ui-secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--ui-muted))",
          foreground: "hsl(var(--ui-muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--ui-accent))",
          foreground: "hsl(var(--ui-accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--ui-destructive))",
          foreground: "hsl(var(--ui-destructive-foreground))"
        },
        border: "hsl(var(--ui-border))",
        input: "hsl(var(--ui-input))",
        ring: "hsl(var(--ui-ring))",
        success: "hsl(var(--ui-success))",
        warning: "hsl(var(--ui-warning))",
        info: "hsl(var(--ui-info))"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 18px 42px rgba(16,24,40,.07)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
