import { useEffect, useRef } from 'react';
import { cn } from '@/shared/utils/cn';

type Props = {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
  label?: string;
};

export function VideoPreview({
  stream,
  muted = false,
  mirror = false,
  className,
  label,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <div className={cn('relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black/80 sm:aspect-video', className)}>
      {label ? (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-ds-xs font-medium text-white">
          {label}
        </span>
      ) : null}
      <video
        ref={ref}
        playsInline
        autoPlay
        muted={muted}
        className={cn('h-full w-full object-cover', mirror && 'scale-x-[-1]')}
      />
    </div>
  );
}
