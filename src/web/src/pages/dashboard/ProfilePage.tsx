import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast'; // ^2.4.1
import Card from '../../components/common/Card';
import UserForm from '../../components/user/UserForm';
import { useAuth } from '../../hooks/useAuth';
import userService from '../../services/user.service';
import { UserFormData } from '../../types/user.types';

/**
 * ProfilePage component displays and allows editing of the current user's profile information.
 * Provides enhanced error handling, accessibility features, and real-time validation feedback.
 */
const ProfilePage: React.FC = () => {
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * Handles the submission of updated profile information
   * Includes comprehensive error handling and validation
   * 
   * @param formData - Form data containing updated user information
   */
  const handleProfileUpdate = useCallback(async (formData: UserFormData): Promise<void> => {
    if (!user) return;
    
    setIsSubmitting(true);
    setErrorMessage('');
    
    try {
      // Update user profile with validated form data
      await userService.updateUser(user.id, {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName
      });
      
      // Show success notification with screen reader support
      toast.success('Profile updated successfully!', { 
        id: 'profile-update-success',
        duration: 4000,
        ariaProps: {
          role: 'status',
          'aria-live': 'polite',
        }
      });
    } catch (error) {
      // Format error message for display
      const message = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred while updating your profile';
      
      setErrorMessage(message);
      
      // Show error notification with screen reader support
      toast.error(message, {
        id: 'profile-update-error',
        duration: 5000,
        ariaProps: {
          role: 'alert',
          'aria-live': 'assertive',
        }
      });
      
      console.error('Error updating profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [user]);

  // Show loading spinner while user data is being fetched
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" 
          aria-label="Loading user data..." 
          role="status" 
        />
      </div>
    );
  }

  // Show error message if user data is not available
  if (!user) {
    return (
      <div 
        className="p-4 text-red-700 bg-red-100 rounded-md" 
        role="alert"
      >
        Error: Unable to load user data. Please try refreshing the page.
      </div>
    );
  }

  // Prepare initial form values from user data
  const initialValues: Partial<UserFormData> = {
    email: user.email,
    role: user.role,
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <h1 
        className="text-2xl font-semibold mb-6" 
        id="profile-heading"
      >
        My Profile
      </h1>
      
      {errorMessage && (
        <div 
          className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded" 
          role="alert"
        >
          {errorMessage}
        </div>
      )}
      
      <UserForm
        initialValues={initialValues as UserFormData}
        onSubmit={handleProfileUpdate}
        isLoading={isSubmitting}
        userRole={user.role}
        aria-labelledby="profile-heading"
      />
    </Card>
  );
};

export default ProfilePage;