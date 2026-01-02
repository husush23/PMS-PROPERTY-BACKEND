import { ValidationError } from 'class-validator';

export interface FormattedValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export class ValidationErrorFormatter {
  static format(errors: ValidationError[]): FormattedValidationError[] {
    return errors.map((error) => this.formatSingleError(error)).flat();
  }

  private static formatSingleError(
    error: ValidationError,
  ): FormattedValidationError[] {
    const formattedErrors: FormattedValidationError[] = [];

    // Get the field name (handle nested properties)
    const field = error.property;

    // Format constraint messages
    if (error.constraints) {
      Object.keys(error.constraints).forEach((key) => {
        const constraintValue = error.constraints?.[key];
        if (constraintValue) {
          formattedErrors.push({
            field,
            message: this.getHumanReadableMessage(constraintValue, error),
            value: error.value,
          });
        }
      });
    }

    // Handle nested validation errors
    if (error.children && error.children.length > 0) {
      error.children.forEach((childError) => {
        const nestedErrors = this.formatSingleError(childError);
        nestedErrors.forEach((nestedError) => {
          formattedErrors.push({
            field: `${field}.${nestedError.field}`,
            message: nestedError.message,
            value: nestedError.value,
          });
        });
      });
    }

    return formattedErrors;
  }

  private static getHumanReadableMessage(
    constraintMessage: string,
    error: ValidationError,
  ): string {
    // Map common constraint messages to more user-friendly ones
    const messageMap: Record<string, string> = {
      'must be an email': 'must be a valid email address',
      'must be longer than or equal to': 'must be at least',
      'must be shorter than or equal to': 'must be at most',
      'must be a UUID': 'must be a valid identifier',
      'must match': 'must match the required format',
    };

    let message = constraintMessage;

    // Replace technical messages with friendly ones
    Object.keys(messageMap).forEach((key) => {
      if (message.includes(key)) {
        message = message.replace(key, messageMap[key]);
      }
    });

    // Extract numeric values from constraints for better messages
    if (error.constraints) {
      if (error.constraints['isLength']) {
        const minLength = error.constraints['minLength']?.match(/\d+/)?.[0];
        const maxLength = error.constraints['maxLength']?.match(/\d+/)?.[0];
        if (minLength && maxLength) {
          message = `must be between ${minLength} and ${maxLength} characters`;
        } else if (minLength) {
          message = `must be at least ${minLength} characters long`;
        } else if (maxLength) {
          message = `must be at most ${maxLength} characters long`;
        }
      }
    }

    // Capitalize first letter
    return message.charAt(0).toUpperCase() + message.slice(1);
  }
}
