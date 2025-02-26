/**
 * Authentication Components
 * 
 * This barrel file exports all authentication-related form components for centralized access
 * and type-safe importing. It serves as the main entry point for authentication UI components,
 * enabling tree-shakeable imports and consistent component access patterns.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';

export {
  LoginForm,
  RegisterForm,
  ForgotPasswordForm,
  ResetPasswordForm
};