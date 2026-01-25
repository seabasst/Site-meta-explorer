import { z } from 'zod';

/**
 * Validation schema for Facebook Ad Library URLs.
 * Validates format, domain, and required parameters.
 */
export const adLibraryUrlSchema = z.object({
  url: z
    .string()
    .min(1, 'Please enter an Ad Library URL')
    .url('Please enter a valid URL')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return (
            parsed.hostname.includes('facebook.com') &&
            parsed.pathname.includes('/ads/library')
          );
        } catch {
          return false;
        }
      },
      { message: 'URL must be a Facebook Ad Library link' }
    )
    .refine(
      (url) => url.includes('view_all_page_id='),
      { message: 'URL must include a page ID (view_all_page_id parameter)' }
    ),
});

export type AdLibraryUrlInput = z.infer<typeof adLibraryUrlSchema>;

/**
 * Validate URL synchronously for quick checks
 */
export function validateAdLibraryUrl(url: string): { valid: boolean; error?: string } {
  const result = adLibraryUrlSchema.safeParse({ url });

  if (result.success) {
    return { valid: true };
  }

  const firstIssue = result.error.issues[0];
  return { valid: false, error: firstIssue?.message };
}
