import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SaveEditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
}

export default function SaveEditsDialog({
  open,
  onOpenChange,
  onSave,
  onDiscard,
}: SaveEditsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm z-[60]">
        <AlertDialogHeader>
          <AlertDialogTitle>Lưu thay đổi?</AlertDialogTitle>
          <AlertDialogDescription>
            Phần đang sửa sẽ mất nếu không lưu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onDiscard}
            className="text-destructive hover:text-destructive"
          >
            Hủy
          </AlertDialogCancel>
          <AlertDialogAction onClick={onSave}>Lưu</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
