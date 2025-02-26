import React, { Fragment } from 'react'; // v18.x
import classNames from 'classnames'; // v2.x
import { Dialog, Transition } from '@headlessui/react'; // v1.x
import { useTheme } from '../../hooks/useTheme';
import Button from './Button';
import { Theme } from '../../types/theme.types';

/**
 * Props interface for Modal component with comprehensive configuration options
 */
export interface ModalProps {
  /** Content to display inside the modal */
  children: React.ReactNode;
  /** Controls whether the modal is displayed */
  isOpen: boolean;
  /** Function called when the modal should close */
  onClose: () => void;
  /** Modal title displayed in the header */
  title: string;
  /** Controls the width of the modal */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes to apply to the modal */
  className?: string;
  /** Ref to the element that should receive focus when the modal opens */
  initialFocus?: React.RefObject<HTMLElement>;
  /** Whether clicking the backdrop closes the modal */
  closeOnOverlayClick?: boolean;
  /** Whether to show a close button in the modal header */
  showCloseButton?: boolean;
}

/**
 * Generates theme-aware Tailwind classes for modal styling
 * 
 * @param props - Modal properties
 * @param theme - Current theme state
 * @returns Concatenated Tailwind classes for modal styling
 */
const getModalClasses = (props: ModalProps, theme: Theme): string => {
  const { size = 'md', className = '' } = props;
  
  // Base modal classes with rounded corners and padding
  const baseClasses = 'relative rounded-lg p-6 shadow-xl overflow-hidden';
  
  // Size-specific width classes
  const sizeClasses = {
    sm: 'max-w-sm w-full',
    md: 'max-w-md w-full',
    lg: 'max-w-lg w-full',
    xl: 'max-w-xl w-full'
  };
  
  // Theme-specific background and text colors
  const themeClasses = theme.isDark
    ? 'bg-gray-800 text-white border border-gray-700'
    : 'bg-white text-gray-900 border border-gray-200';
  
  // Backdrop blur effect
  const backdropClasses = 'backdrop-filter backdrop-blur-sm';
  
  // Transition classes for smooth animations
  const transitionClasses = 'transition-all duration-300 ease-in-out';
  
  // Combine all class groups
  return classNames(
    baseClasses,
    sizeClasses[size],
    themeClasses,
    backdropClasses,
    transitionClasses,
    className
  );
};

/**
 * Accessible modal dialog component with theme support and customizable styling
 * Implements WCAG 2.1 Level AA accessibility standards with keyboard navigation
 * and screen reader support.
 * 
 * Features:
 * - Keyboard navigation (Escape to close)
 * - Focus trap within modal when open
 * - Proper ARIA attributes
 * - Theme-aware styling (light/dark mode)
 * - Smooth animations and transitions
 * - Customizable size and behavior
 * 
 * @param props - Modal properties
 * @returns JSX.Element - Rendered modal element
 */
const Modal: React.FC<ModalProps> = (props) => {
  const {
    children,
    isOpen,
    onClose,
    title,
    initialFocus,
    closeOnOverlayClick = true,
    showCloseButton = true
  } = props;
  
  // Get current theme for styling
  const { theme } = useTheme();
  
  // Generate modal classes with theme support
  const modalClasses = getModalClasses(props, theme);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-50 overflow-y-auto"
        onClose={closeOnOverlayClick ? onClose : () => {}}
        initialFocus={initialFocus}
      >
        <div className="flex min-h-screen items-center justify-center p-4 text-center">
          {/* Backdrop with animation */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay 
              className={classNames(
                "fixed inset-0 transition-opacity",
                theme.isDark 
                  ? "bg-black bg-opacity-70 backdrop-blur-sm" 
                  : "bg-black bg-opacity-50 backdrop-blur-sm"
              )}
              aria-hidden="true" 
            />
          </Transition.Child>

          {/* Modal panel with animation */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel 
              className={modalClasses}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              {/* Modal header with title and close button */}
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title
                  as="h3"
                  id="modal-title"
                  className={classNames(
                    "text-lg font-medium leading-6",
                    theme.isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {title}
                </Dialog.Title>
                
                {showCloseButton && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onClose}
                    ariaLabel="Close modal"
                    className={theme.isDark 
                      ? "text-gray-300 hover:bg-gray-700" 
                      : "text-gray-500 hover:bg-gray-100"
                    }
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Button>
                )}
              </div>
              
              {/* Modal content */}
              <div className={classNames(
                "mt-2",
                theme.isDark ? "text-gray-300" : "text-gray-700"
              )}>
                {children}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Modal;