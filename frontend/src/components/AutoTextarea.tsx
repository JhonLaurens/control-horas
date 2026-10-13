import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** Textarea que crece con el contenido entre minRows y maxRows; después hace scroll. Conserva saltos de línea. */
export function AutoTextarea({ minRows = 4, maxRows = 14, value, style, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; maxRows?: number; value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight) || 20;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = 'auto';
    const h = Math.min(Math.max(el.scrollHeight + (cs.boxSizing === 'border-box' ? parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) : 0), minRows * lh + pad), maxRows * lh + pad);
    el.style.height = h + 'px';
    el.style.overflowY = el.scrollHeight > h ? 'auto' : 'hidden';
  }, [value, minRows, maxRows]);
  return <textarea ref={ref} rows={minRows} value={value} style={style} {...rest} />;
}
