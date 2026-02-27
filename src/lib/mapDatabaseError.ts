/**
 * Maps raw database/Supabase errors to safe, user-friendly messages.
 * Detailed errors are logged to the console in development only.
 */
export const mapDatabaseError = (error: unknown): string => {
  if (import.meta.env.DEV) {
    console.error('Database error:', error);
  }

  if (!error || typeof error !== 'object') {
    return 'אירעה שגיאה. נסה שוב או פנה לתמיכה.';
  }

  const err = error as { code?: string; message?: string };

  if (err.code === '23505') return 'רשומה זו כבר קיימת';
  if (err.code === '23503') return 'הפניה לנתונים לא תקינה';
  if (err.code === '23514') return 'הנתונים שהוזנו אינם תקינים';
  if (err.message?.includes('row-level security')) {
    return 'אין לך הרשאה לבצע פעולה זו';
  }
  if (err.message?.includes('Please wait')) {
    return 'נא להמתין לפני הפעלה חוזרת';
  }
  if (err.message?.includes('Unauthorized')) {
    return 'אין לך הרשאה לבצע פעולה זו';
  }

  return 'אירעה שגיאה. נסה שוב או פנה לתמיכה.';
};
