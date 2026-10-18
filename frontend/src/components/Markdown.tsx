import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

// Minimal prose styles bound to design tokens; no external typography presets.
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed text-fg space-y-3',
        '[&_p]:my-2',
        '[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2',
        '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2',
        '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
        '[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2',
        '[&_li]:my-1',
        '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_blockquote]:my-2',
        '[&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-2xs [&_code]:font-mono [&_code]:before:content-none [&_code]:after:content-none',
        '[&_pre]:bg-surface-2 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-2',
        '[&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-2xs',
        '[&_table]:w-full [&_table]:border-collapse [&_table]:my-2',
        '[&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        '[&_hr]:border-border [&_hr]:my-4',
        '[&_img]:max-w-full [&_img]:rounded',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
