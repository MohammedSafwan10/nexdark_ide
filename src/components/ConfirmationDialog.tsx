import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string; // e.g., "Save"
  dontSaveText?: string; // e.g., "Don't Save"
  cancelText?: string; // e.g., "Cancel"
  onConfirm: () => void; 
  onDontSave?: () => void; // Optional if only Confirm/Cancel needed
  onCancel: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  dontSaveText = "Don't Save",
  cancelText = 'Cancel',
  onConfirm,
  onDontSave,
  onCancel,
}) => {
  if (!isOpen) return null;

  // Prevent background scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      onClick={onCancel} // Close on backdrop click
    >
      <div 
        className="bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg shadow-xl w-full max-w-md p-6 border border-[var(--border-subtle)]"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <p className="text-[var(--text-secondary)] mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          {onDontSave && (
            <button
              onClick={onDontSave}
              className="px-4 py-2 rounded bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover-bg)] transition-colors"
            >
              {dontSaveText}
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)] hover:bg-[var(--button-secondary-hover-bg)] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] hover:bg-[var(--button-primary-hover-bg)] transition-colors font-medium"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog; 