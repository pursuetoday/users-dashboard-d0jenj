/**
 * PostCSS Configuration
 * 
 * This file configures the PostCSS processing pipeline for the User Management Dashboard application.
 * It optimizes CSS processing with Tailwind CSS, handles responsive styles, theme variables,
 * and ensures cross-browser compatibility.
 * 
 * @see https://postcss.org/
 */

// Import required PostCSS plugins
const tailwindcss = require('tailwindcss'); // ^3.0.0
const autoprefixer = require('autoprefixer'); // ^10.4.0
const postcssImport = require('postcss-import'); // ^15.0.0
const postcssNested = require('postcss-nested'); // ^6.0.0

// Extract relevant configuration from the TypeScript config file
const tailwindConfig = require('./tailwind.config.ts');

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

/**
 * PostCSS configuration object
 * Order of plugins is important:
 * 1. postcss-import: Handles @import rules first
 * 2. tailwindcss/nesting: Handles Tailwind specific nesting
 * 3. tailwindcss: Processes Tailwind directives and utilities
 * 4. autoprefixer: Adds vendor prefixes
 * 5. postcss-nested: Processes remaining nested styles
 */
module.exports = {
  plugins: [
    // Handle @import rules and file concatenation
    postcssImport({
      path: ['src/web/styles'],
      skipDuplicates: true
    }),
    
    // Support nesting with Tailwind-specific features
    require('tailwindcss/nesting'),
    
    // Process Tailwind CSS utilities and directives
    tailwindcss({
      config: './tailwind.config.ts',
      mode: 'jit' // Use Just-In-Time compiler for better performance
    }),
    
    // Add vendor prefixes for browser compatibility
    autoprefixer({
      flexbox: 'no-2009', // More modern flexbox implementation
      grid: 'autoplace' // Auto placement for CSS Grid
    }),
    
    // Process nested CSS rules for modular styling
    postcssNested({
      bubble: ['screen'] // Properly handle media queries in nested CSS
    }),
    
    // Add minification in production only
    ...(isProduction ? [require('cssnano')({ preset: 'default' })] : [])
  ],
  
  // Generate source maps in development for better debugging
  sourceMap: isDevelopment,
  
  // Additional plugin options can be specified here if needed
  // This enables deep configuration beyond the basic plugin setup
  map: isDevelopment ? { inline: true } : false
};