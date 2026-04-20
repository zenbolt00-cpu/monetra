import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'"SF Pro Text"',
  				'"SF Pro Display"',
  				'"Segoe UI"',
  				'Roboto',
  				'"Helvetica Neue"',
  				'Arial',
  				'sans-serif'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
        ios: {
          blue: '#0A84FF',
          green: '#32D74B',
          red: '#FF453A',
          yellow: '#FFD60A'
        }
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 6px)',
  			sm: 'calc(var(--radius) - 10px)',
        card: '24px',
        modal: '32px',
        button: '16px'
  		},
      boxShadow: {
        'ios-soft': '0 8px 40px rgba(0, 0, 0, 0.04)',
        'ios-medium': '0 12px 60px rgba(0, 0, 0, 0.08)',
        'ios-heavy': '0 20px 80px rgba(0, 0, 0, 0.12)',
        'glass-light': 'inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 8px 30px rgba(0, 0, 0, 0.05)',
      },
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
        'spring-entrance': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
        'spring-entrance': 'spring-entrance 0.4s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

