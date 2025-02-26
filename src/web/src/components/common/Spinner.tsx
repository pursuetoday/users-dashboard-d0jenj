import { FC } from 'react'; // v18.x
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the Spinner component defining customization options
 */
interface SpinnerProps {
  /**
   * Size variant of the spinner
   * - 'sm': Small (16px)
   * - 'md': Medium (24px)
   * - 'lg': Large (32px)
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Custom color override for the spinner
   * Accepts Tailwind colors or hex values
   * If not provided, uses theme-based colors
   */
  color?: string;

  /**
   * Additional CSS classes for custom styling and layout
   */
  className?: string;
}

/**
 * A theme-aware loading spinner component that renders an animated SVG
 * with customizable size and color while maintaining accessibility standards.
 * 
 * Features:
 * - Automatically adapts to current theme (light/dark)
 * - Customizable size with predefined options
 * - Custom color override option
 * - Proper ARIA attributes for accessibility
 * - Smooth animations with CSS transitions
 * 
 * @example
 * // Basic usage with default size
 * <Spinner />
 * 
 * @example
 * // Custom size and additional classes
 * <Spinner size="lg" className="mt-4" />
 * 
 * @example
 * // Custom color override
 * <Spinner color="text-blue-500" />
 */
const Spinner: FC<SpinnerProps> = ({ 
  size = 'md', 
  color,
  className = ''
}) => {
  // Access current theme state
  const { theme } = useTheme();

  // Determine spinner color based on theme and color prop
  const spinnerColor = color || (theme.isDark ? 'text-blue-400' : 'text-blue-600');
  
  // Calculate spinner dimensions based on size prop
  const dimensions = {
    sm: 16,
    md: 24,
    lg: 32
  }[size];
  
  // Construct className string with Tailwind utilities
  const spinnerClasses = `
    inline-block
    animate-spin
    ${spinnerColor}
    ${className}
    transition-colors
    duration-200
  `.trim().replace(/\s+/g, ' ');

  return (
    <svg
      className={spinnerClasses}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={dimensions}
      height={dimensions}
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export default Spinner;