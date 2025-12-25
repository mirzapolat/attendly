/**
 * Sanitize database/API error messages for safe display to users.
 * Prevents leaking internal schema details, table names, and implementation info.
 */
export function sanitizeError(error: unknown): string {
  // Log full error for debugging (server-side only in production)
  console.error('Full error:', error);
  
  if (!error || typeof error !== 'object') {
    return 'An error occurred. Please try again.';
  }
  
  const err = error as { code?: string; message?: string };
  
  // Map specific Postgres error codes to user-friendly messages
  if (err.code === '23505') {
    return 'This record already exists.';
  }
  if (err.code === '23503') {
    return 'Referenced record not found.';
  }
  if (err.code === '23514') {
    return 'Invalid data provided. Please check your input.';
  }
  if (err.code === '42501' || err.message?.includes('row-level security')) {
    return 'You do not have permission to perform this action.';
  }
  if (err.code === '22P02') {
    return 'Invalid data format provided.';
  }
  if (err.code === 'PGRST116') {
    return 'Record not found.';
  }
  
  // Check for network errors
  if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  // Generic fallback - never expose raw error messages
  return 'An error occurred. Please try again or contact support.';
}
