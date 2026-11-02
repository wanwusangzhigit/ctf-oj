import { Download, Paperclip, Trash2 } from 'lucide-react';
import { Button, useConfirm } from '@/components/ui';
import { attachmentDownloadURL } from '@/api/challenge';
import { formatBytes } from '@/lib/utils';
import type { Attachment } from '@/types';

/**
 * AttachmentManager — list / upload / delete the downloadable attachments
 * for a challenge. Attachments are publicly downloadable so plain <a href>
 * is fine here (unlike SourceFileManager which needs auth headers).
 */
export function AttachmentManager({
  attachments,
  uploading,
  deleting,
  onUpload,
  onDelete,
}: {
  challengeId: number;
  attachments: Attachment[];
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onDelete: (aid: number) => void;
}) {
  const confirm = useConfirm();

  return (
    <div className="border border-rule bg-paper-2 p-4 space-y-3 rounded-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium inline-flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-amber" />
          附件
        </span>
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
          <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm border border-rule-strong text-2xs font-medium hover:bg-paper transition-colors">
            <Paperclip className="h-3 w-3" />
            {uploading ? '上传中…' : '上传文件'}
          </span>
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-2xs text-ink-3">暂无附件。题目保存后即可上传。</p>
      ) : (
        <ul className="border-t border-rule">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="grid grid-cols-[1fr_auto] gap-x-3 items-center py-2 border-b border-rule last:border-b-0 text-sm"
            >
              <a
                href={attachmentDownloadURL(a.challengeId, a.id)}
                className="inline-flex items-center gap-2 min-w-0 hover:text-amber transition-colors"
              >
                <Download className="h-3 w-3 shrink-0" />
                <span className="truncate">{a.filename}</span>
                <span className="text-2xs text-ink-3 shrink-0 tabular-nums">
                  ({formatBytes(a.size)})
                </span>
              </a>
              <Button
                variant="ghost"
                size="icon"
                loading={deleting}
                onClick={async () => {
                  const ok = await confirm({
                    title: '删除附件',
                    description: `附件「${a.filename}」将被删除，无法恢复。`,
                    confirmText: '删除',
                  });
                  if (ok) onDelete(a.id);
                }}
                aria-label="删除附件"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
