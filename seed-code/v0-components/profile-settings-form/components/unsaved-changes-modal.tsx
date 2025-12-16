'use client';

import { Button } from '@/components/ui/button';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onStayAndSave: () => void;
  onLeave: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  isOpen,
  onStayAndSave,
  onLeave,
  onCancel,
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-xl font-bold mb-4">You have unsaved changes</h2>
        <p className="text-gray-600 mb-6">
          Are you sure you want to leave? Your changes will be lost.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            onClick={onStayAndSave}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Stay & Save
          </Button>
          <Button
            onClick={onLeave}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500 bg-transparent"
          >
            Leave Without Saving
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full bg-transparent"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
