import { createContext, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
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

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmContextValue | null>(null);

const defaultOptions: Required<Pick<ConfirmOptions, "confirmText" | "cancelText" | "variant">> = {
  confirmText: "Confirm",
  cancelText: "Cancel",
  variant: "default",
};

const getAccentClasses = (variant: ConfirmOptions["variant"]) => {
  if (variant === "destructive") {
    return {
      ring: "ring-rose-500/10",
      icon: "bg-rose-500/15 text-rose-600",
      action: "bg-rose-600 hover:bg-rose-600/90",
    };
  }
  return {
    ring: "ring-primary/10",
    icon: "bg-primary/15 text-primary",
    action: "",
  };
};

export const ConfirmDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const skipNextCloseRef = useRef(false);

  const confirm = useMemo<ConfirmContextValue>(
    () => (nextOptions: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions(nextOptions);
        setOpen(true);
      }),
    [],
  );

  const closeWithResult = (result: boolean) => {
    if (!open) return;
    skipNextCloseRef.current = true;
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const { title, description, confirmText, cancelText, variant } = {
    ...defaultOptions,
    ...options,
  };

  const accent = getAccentClasses(variant);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && open) {
            if (skipNextCloseRef.current) {
              skipNextCloseRef.current = false;
            } else {
              resolverRef.current?.(false);
              resolverRef.current = null;
            }
          }
          setOpen(nextOpen);
        }}
      >
        <AlertDialogContent
          className={`overflow-hidden border-0 bg-background p-0 shadow-xl ring-1 ${accent.ring}`}
        >
          <div className="px-6 py-6">
            <AlertDialogHeader>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${accent.icon}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-2 text-center sm:text-left">
                  <AlertDialogTitle>{title ?? "Are you sure?"}</AlertDialogTitle>
                  {description ? (
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                  ) : null}
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel onClick={() => closeWithResult(false)}>
                {cancelText}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => closeWithResult(true)}
                className={accent.action}
              >
                {confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return context;
};
