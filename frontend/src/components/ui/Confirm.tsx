import { useCallback, createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';

export type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmText: string;
  cancelText?: string;
  /** Destructive by default; pass false when the action is reversible. */
  danger?: boolean;
};

type Pending = {
  options: ConfirmOptions;
  resolve: (accepted: boolean) => void;
};

const Ctx = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second request replaces the first one and settles it as declined.
        pendingRef.current?.resolve(false);
        const next = { options, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  const decide = useCallback((accepted: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(accepted);
  }, []);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending.options} onDecide={decide} />}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

function ConfirmDialog({
  options,
  onDecide,
}: {
  options: ConfirmOptions;
  onDecide: (accepted: boolean) => void;
}) {
  const { t } = useTranslation();
  const danger = options.danger !== false;
  return (
    <Modal
      open
      onClose={() => onDecide(false)}
      title={options.title}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" data-autofocus onClick={() => onDecide(false)}>
            {options.cancelText ?? t('action.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => onDecide(true)}>
            {options.confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">{options.description}</p>
    </Modal>
  );
}
