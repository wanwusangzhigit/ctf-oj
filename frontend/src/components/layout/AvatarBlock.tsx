import i18n from '@/locales/i18n';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { Spinner, useToast } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { avatarURL, uploadAvatar } from '@/api/user';
import { ApiClientError } from '@/api/client';

export type AvatarBlockProps = {
  user: { id: number; username: string; hasAvatar?: boolean };
  editable?: boolean;
};

/**
 * Profile avatar. When `editable` it exposes the upload affordance, which is
 * only used from the settings screen.
 */
export function AvatarBlock({ user, editable = false }: AvatarBlockProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error(i18n.t('头像不能超过 2MB'));
      return;
    }
    setUploading(true);
    try {
      await uploadAvatar(f);
      await qc.invalidateQueries({ queryKey: ['user'] });
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      toast.success(i18n.t('头像已更新'));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('上传失败'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="relative shrink-0">
      {user.hasAvatar && !avatarFailed ? (
        <img
          src={avatarURL(user.id)}
          alt={user.username}
          className="h-16 w-16 rounded-sm object-cover border border-rule bg-paper-2"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <Avatar name={user.username} className="h-16 w-16 text-xl" />
      )}
      {editable && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label={i18n.t('更换头像')}
          className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-ink text-paper border border-paper hover:bg-ink-2 transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
