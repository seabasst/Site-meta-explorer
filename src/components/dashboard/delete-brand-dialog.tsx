'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteBrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandName: string;
  onConfirm: () => void;
  loading?: boolean;
  count?: number;
}

export function DeleteBrandDialog({
  open,
  onOpenChange,
  brandName,
  onConfirm,
  loading,
  count,
}: DeleteBrandDialogProps) {
  const isBulk = count != null && count > 1;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[var(--bg-secondary)] border-[var(--border-subtle)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[var(--text-primary)]">
            {isBulk ? `Delete ${count} brands?` : `Delete ${brandName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--text-muted)]">
            {isBulk
              ? `This will permanently remove ${count} brands and all their analysis history. This action cannot be undone.`
              : 'This will permanently remove the brand and all its analysis history. This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
