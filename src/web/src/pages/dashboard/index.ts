/**
 * Barrel Export for Dashboard-Related Page Components
 *
 * This file centralizes the exports of all dashboard-related page components,
 * providing a single access point for the dashboard section of the User Management Dashboard.
 * It enhances code organization, ensures TypeScript type safety, and includes comprehensive
 * documentation for enterprise-grade applications.
 *
 * Exported Components:
 * - DashboardPage: Main dashboard overview page component for displaying metrics, summaries,
 *   and key performance indicators.
 * - ProfilePage: Page component for managing user profile settings, preferences, and personal information.
 * - SettingsPage: Page component for configuring application-wide settings and preferences.
 * - UsersPage: User management page component with interactive data table functionality and 
 *   real-time editing capabilities.
 *
 * Requirements Addressed:
 * - User Management Interface (Interactive data table with real-time editing capabilities)
 *   See: 1.2 SYSTEM OVERVIEW / High-Level Description
 * - Core Features (User management and data visualization dashboard components)
 *   See: 1.3 SCOPE / Core Features and Functionalities
 *
 * @packageDocumentation
 * @module DashboardPages
 * @since 1.0.0
 */

export { default as DashboardPage } from './DashboardPage';
export { default as ProfilePage } from './ProfilePage';
export { default as SettingsPage } from './SettingsPage';
export { default as UsersPage } from './UsersPage';