import { useEffect, useId, useRef, type ReactNode, type ReactElement } from 'react';

export function CommunityDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="community-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header><div><p className="panel-kicker">COMMUNITY AID NETWORK</p><h2 id={titleId}>{title}</h2></div><button type="button" className="community-dialog__close" aria-label={`Close ${title}`} onClick={onClose}>×</button></header>
    <div className="community-dialog__body">{children}</div>
  </dialog>;
}
