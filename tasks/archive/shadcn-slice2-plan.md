# shadcn Slice 2: Dialog & Toast Migration

## Scope
Replace custom Modal, ConfirmDialog, and Toast with shadcn Dialog, AlertDialog, and Sonner.

## Steps

### 1. Add shadcn primitives
- `src/components/ui/dialog.tsx` — wraps @radix-ui/react-dialog
- `src/components/ui/alert-dialog.tsx` — wraps @radix-ui/react-alert-dialog
- `npm install sonner` + `src/components/ui/sonner.tsx` wrapper

### 2. Migrate Modal → Dialog
- **ChooseImageModal.tsx**: swap `<Modal>` → `<Dialog>` primitives
- **items/[id]/page.tsx**: remove Modal import (only used via ChooseImageModal)
- Delete `src/components/Modal.tsx`

### 3. Migrate ConfirmDialog → AlertDialog
- Rewrite `ConfirmProvider` internals to use shadcn AlertDialog
- Keep `useConfirm()` API identical (Promise<boolean>)
- Remove old CSS: `.confirm-panel`, `.confirm-title`, `.confirm-message`, `.confirm-actions`

### 4. Migrate Toast → Sonner
- Create `useToast()` compatibility wrapper that calls `toast.success()` / `toast.error()` / `toast.info()`
- Add `<Toaster />` in layout
- Remove `ToastProvider` wrapper from layout
- Remove old CSS: `.toast-container`, `.toast`, `.toast-*`
- Delete `src/components/Toast.tsx`

### 5. Clean up globals.css
- Remove `.modal-overlay`, `.modal-panel`, `.modal-header`, `.modal-close`, `.modal-body`, `.modal-actions`
- Remove `.confirm-panel`, `.confirm-title`, `.confirm-message`, `.confirm-actions`
- Remove `.toast-container`, `.toast`, `.toast-*`, `@keyframes toast-in`
- Keep `@keyframes fade-in` and `@keyframes scale-in` if used elsewhere

### 6. Verify
- `npm run build` passes
- All destructive actions trigger confirms
- All toast callsites work

## Callsite Inventory
- **Modal**: 2 files (ChooseImageModal, items/[id]/page.tsx)
- **useConfirm()**: 13 consumer files
- **useToast()**: 26 consumer files — API must stay identical
