import { useState, useCallback } from 'react';
import { FormField, FormState, FormConfig } from '../types/form.types';
import { 
  initializeFormState, 
  handleFieldChange, 
  handleFormSubmit 
} from '../utils/form.utils';

/**
 * Enhanced custom hook for secure form state management and validation with accessibility support
 * 
 * @param config - Form configuration object
 * @returns Form state and handlers object containing values, errors, touched states, validation state, security metrics, and form manipulation functions
 */
const useForm = (config: FormConfig) => {
  // Initialize secure form state with validation and accessibility defaults
  const [formState, setFormState] = useState<FormState>(() => 
    initializeFormState(config.fields, config.initialValues)
  );

  // Create security monitoring state for rate limiting and pattern detection
  const [securityMetrics, setSecurityMetrics] = useState({
    suspicious: false,
    attempts: 0,
    lastAttempt: 0,
    patterns: [] as string[],
    fieldAttempts: {} as Record<string, number>
  });

  // Initialize accessibility support with ARIA attributes
  const [ariaAttributes, setAriaAttributes] = useState(() => {
    const attributes: Record<string, Record<string, string>> = {};
    
    config.fields.forEach(field => {
      attributes[field.name] = {
        'aria-invalid': 'false',
        'aria-required': field.required ? 'true' : 'false',
        'aria-describedby': `${field.name}-error`
      };
      
      // Add custom ARIA attributes if provided
      if (field.aria?.label) {
        attributes[field.name]['aria-label'] = field.aria.label;
      }
      
      if (field.aria?.description) {
        attributes[field.name]['aria-description'] = field.aria.description;
      }
    });
    
    return attributes;
  });

  // Create debounced onChange handler with input sanitization
  const handleChange = useCallback(async (fieldName: string, value: any) => {
    // Security: Track field attempt frequency for potential abuse detection
    setSecurityMetrics(prev => ({
      ...prev,
      fieldAttempts: {
        ...prev.fieldAttempts,
        [fieldName]: (prev.fieldAttempts[fieldName] || 0) + 1
      },
      lastAttempt: Date.now()
    }));

    // Security: Check for suspiciously rapid field changes
    const fieldAttempts = securityMetrics.fieldAttempts[fieldName] || 0;
    const timeSinceLastAttempt = Date.now() - securityMetrics.lastAttempt;
    
    if (fieldAttempts > 20 && timeSinceLastAttempt < 100) {
      // Suspiciously fast input changes might indicate automated attacks
      setSecurityMetrics(prev => ({
        ...prev,
        suspicious: true
      }));
      console.warn(`Suspicious rapid changes detected for field: ${fieldName}`);
    }

    try {
      // Process field change with validation using the imported utility
      const newState = await handleFieldChange(formState, fieldName, value, config.fields);
      setFormState(newState);
      
      // Check if we need to validate dependent fields
      const field = config.fields.find(f => f.name === fieldName);
      if (field) {
        // Find fields that depend on this field
        const dependentFields = config.fields.filter(f => 
          f.dependencies && f.dependencies.includes(fieldName)
        );
        
        // Validate dependent fields if they exist
        if (dependentFields.length > 0) {
          let updatedState = newState;
          
          // Process each dependent field
          for (const depField of dependentFields) {
            const fieldVisible = typeof depField.visible === 'function' 
              ? depField.visible(updatedState.values) 
              : depField.visible !== false;
              
            if (fieldVisible) {
              updatedState = await handleFieldChange(
                updatedState, 
                depField.name, 
                updatedState.values[depField.name], 
                config.fields
              );
            }
          }
          
          // Apply all dependent field validations
          setFormState(updatedState);
        }
      }
    } catch (error) {
      console.error(`Error handling field change for ${fieldName}:`, error);
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [fieldName]: 'An unexpected error occurred during validation'
        },
        isValid: false
      }));
    }
  }, [formState, config.fields, securityMetrics]);

  // Create memoized onBlur handler with validation
  const handleBlur = useCallback(async (fieldName: string) => {
    // Mark field as touched on blur
    if (!formState.touched[fieldName]) {
      setFormState(prevState => ({
        ...prevState,
        touched: {
          ...prevState.touched,
          [fieldName]: true
        }
      }));
    }
    
    // Trigger validation for this field if configured
    if (config.validateOnBlur !== false) {
      try {
        // Find the field configuration
        const fieldConfig = config.fields.find(f => f.name === fieldName);
        if (fieldConfig) {
          // Validate without changing the value
          const newState = await handleFieldChange(
            formState,
            fieldName,
            formState.values[fieldName],
            config.fields
          );
          setFormState(newState);
        }
      } catch (error) {
        console.error(`Error validating field on blur: ${fieldName}`, error);
      }
    }
  }, [formState, config.fields, config.validateOnBlur]);

  // Set up rate-limited onSubmit handler with CSRF protection
  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    // Security: Rate limiting check
    const now = Date.now();
    if (securityMetrics.attempts > 5 && now - securityMetrics.lastAttempt < 10000) {
      setFormState(prevState => ({
        ...prevState,
        errors: {
          ...prevState.errors,
          form: 'Too many submission attempts. Please try again shortly.'
        }
      }));
      return;
    }

    // Security: Check for suspicious activity
    if (securityMetrics.suspicious) {
      setFormState(prevState => ({
        ...prevState,
        errors: {
          ...prevState.errors,
          form: 'Suspicious activity detected. Please try again later.'
        }
      }));
      return;
    }

    // Security: Update submission metrics
    setSecurityMetrics(prevMetrics => ({
      ...prevMetrics,
      attempts: prevMetrics.attempts + 1,
      lastAttempt: now
    }));

    try {
      // Process submission with validation using the imported utility
      const newState = await handleFormSubmit(formState, config.fields, config.onSubmit);
      setFormState(newState);
      
      // Monitor and log suspicious validation patterns
      if (newState.submitCount > 3 && Object.values(newState.errors).some(error => error)) {
        const pattern = Object.keys(newState.errors)
          .filter(key => newState.errors[key])
          .join(',');
        
        setSecurityMetrics(prev => {
          const patterns = [...prev.patterns];
          if (pattern && !patterns.includes(pattern)) {
            patterns.push(pattern);
          }
          
          const suspicious = patterns.length > 2;
          
          if (suspicious) {
            console.warn('Suspicious form submission pattern detected');
          }
          
          return {
            ...prev,
            patterns,
            suspicious
          };
        });
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          form: error instanceof Error ? error.message : 'An unexpected error occurred'
        },
        isSubmitting: false,
        isValid: false
      }));
    }
  }, [formState, config.fields, config.onSubmit, securityMetrics]);

  // Create secure form reset handler
  const resetForm = useCallback(() => {
    // Reset to initial state
    const newState = initializeFormState(config.fields, config.initialValues);
    setFormState(newState);
    
    // Reset security metrics but preserve patterns for security analysis
    setSecurityMetrics(prev => ({
      ...prev,
      attempts: 0,
      lastAttempt: 0,
      fieldAttempts: {},
      suspicious: false
    }));
    
    // Reset ARIA attributes
    const newAttributes = { ...ariaAttributes };
    Object.keys(newAttributes).forEach(fieldName => {
      if (newAttributes[fieldName]) {
        newAttributes[fieldName]['aria-invalid'] = 'false';
      }
    });
  }, [config.fields, config.initialValues, ariaAttributes]);

  // Convenience method to get all required props for a field
  const getFieldProps = useCallback((fieldName: string) => {
    return {
      name: fieldName,
      id: fieldName,
      value: formState.values[fieldName] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => 
        handleChange(fieldName, e.target.value),
      onBlur: () => handleBlur(fieldName),
      disabled: typeof config.fields.find(f => f.name === fieldName)?.disabled === 'function'
        ? config.fields.find(f => f.name === fieldName)?.disabled?.(formState.values)
        : config.fields.find(f => f.name === fieldName)?.disabled,
      ...ariaAttributes[fieldName]
    };
  }, [formState.values, config.fields, handleChange, handleBlur, ariaAttributes]);

  // Return the form state and handlers
  return {
    // Form values and state
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    dirty: formState.dirtyFields,
    isSubmitting: formState.isSubmitting,
    isValid: formState.isValid,
    isValidating: formState.isValidating,
    submitCount: formState.submitCount,
    
    // Security metrics (limited exposure for security reasons)
    security: {
      suspicious: securityMetrics.suspicious,
      submissionAttempts: securityMetrics.attempts
    },
    
    // Accessibility
    aria: ariaAttributes,
    
    // Form handlers
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    
    // Convenience methods
    setFieldValue: handleChange,
    setFieldTouched: handleBlur,
    getFieldProps,
    getFormProps: () => ({
      onSubmit: handleSubmit,
      'aria-live': 'polite',
      noValidate: true
    })
  };
};

export default useForm;