import { Image } from 'lucide-react';
import { usePhotoUrls } from '../hooks/usePhotoUrls.ts';

/** Vignette : première photo ou espace réservé. */
export default function PhotoThumb({ paths, size = 64 }: { paths: string[]; size?: number }) {
  const first = paths.slice(0, 1);
  const urls = usePhotoUrls(first);
  const url = first[0] ? urls[first[0]] : undefined;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400"
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Image size={Math.round(size / 3)} />}
    </div>
  );
}
