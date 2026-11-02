import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Field, Input, Textarea, useConfirm, useToast } from '@/components/ui';
import { Section } from '@/components/admin/SettingsSection';
import { adminBroadcast } from '@/api/admin';
import { ApiClientError } from '@/api/client';

export function AdminSettingsBroadcastPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const broadcastMut = useMutation({
    mutationFn: adminBroadcast,
  });

  const send = async () => {
    const ok = await confirm({
      title: '群发邮件',
      description: '所有注册用户都会收到这封邮件，发出后无法撤回。',
      confirmText: '立即发送',
    });
    if (!ok) return;
    broadcastMut.mutate(
      { subject, body },
      {
        onSuccess: (res) => {
          toast.success(`发送完成：成功 ${res.sent}，失败 ${res.failed}`);
          setSubject('');
          setBody('');
        },
        onError: (err) =>
          toast.error(err instanceof ApiClientError ? err.message : '发送失败'),
      },
    );
  };

  return (
    <div className="space-y-8">
      <Section title="邮件群发">
        <p className="text-2xs text-ink-3">
          向所有未封禁用户发送纯文本邮件。请谨慎使用。
        </p>
        <Field label="主题" htmlFor="mailSubject">
          <Input
            id="mailSubject"
            value={subject}
            maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field label="正文" htmlFor="mailBody">
          <Textarea
            id="mailBody"
            rows={5}
            value={body}
            maxLength={10000}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={!subject.trim() || !body.trim() || broadcastMut.isPending}
            loading={broadcastMut.isPending}
            onClick={send}
          >
            发送
          </Button>
        </div>
      </Section>
    </div>
  );
}
