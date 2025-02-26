import type { Config } from 'tailwindcss'; // v3.x
import * as path from 'path'; // latest

/**
 * Resolves content paths for Tailwind to scan for utility classes
 * @param basePath The base path to resolve from
 * @returns Array of glob patterns for content scanning
 */
const resolveContent = (basePath: string = '.'): string[] => {
  // Join base path with src directory
  const srcDir = path.join(basePath, 'src');
  
  // Return array of file patterns including TypeScript, CSS, and HTML files
  // Include patterns for component files and templates
  return [
    `${srcDir}/**/*.{ts,tsx}`.replace(/\\/g, '/'),
    `${srcDir}/**/*.css`.replace(/\\/g, '/'),
    `${basePath}/index.html`.replace(/\\/g, '/'),
  ];
};

const config: Config = {
  // Content pattern files to scan for utility class usage
  content: [
    './src/**/*.{ts,tsx}',
    './src/**/*.css',
    './index.html',
  ],
  
  // Enable class-based dark mode strategy for theme toggling
  darkMode: 'class',
  
  theme: {
    // Custom color palette using CSS variables for theming
    // This enables light/dark mode color switching
    colors: {
      primary: {
        50: 'var(--color-primary-50)',
        500: 'var(--color-primary-500)',
        600: 'var(--color-primary-600)',
        700: 'var(--color-primary-700)',
      },
      gray: {
        50: 'var(--color-gray-50)',
        100: 'var(--color-gray-100)',
        200: 'var(--color-gray-200)',
        700: 'var(--color-gray-700)',
        800: 'var(--color-gray-800)',
        900: 'var(--color-gray-900)',
      },
    },
    
    // Custom font family configuration
    fontFamily: {
      sans: ['Inter var', 'sans-serif'],
    },
    
    // Mobile-first responsive breakpoints as specified in the UI design specs
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    
    // Extended theme configuration
    extend: {
      spacing: {
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
      },
    },
  },
  
  // Tailwind plugins to enhance styling capabilities
  plugins: [
    require('@tailwindcss/forms'), // v0.5.3 - Enhanced form element styling with consistent design
    require('@tailwindcss/typography'), // v0.5.9 - Typography styling for prose content with responsive design
  ],
};

export default config;