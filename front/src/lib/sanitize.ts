import DOMPurify from 'dompurify';

export const sanitize = (str: string): string => DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });