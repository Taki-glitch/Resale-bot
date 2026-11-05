import { useState } from 'react';
import { uploadPhoto } from '../services/photos.ts';
import { usePhotoUrls } from '../hooks/usePhotoUrls.ts';
import { useAuth } from '../hooks/useAuth.tsx';
import { addPhotoPath, MAX_PHOTOS } from '../core/photos.ts';
import { errMsg } from '../lib/errors.ts';

/** Photos d'un article ou d'une annonce : la première est l'image principale. Les photos sont réduites avant envoi. */
export default function PhotoStrip({
  paths,
  scope,
  onChange,
}: {
  paths: string[];
  scope: string;
  onChange: (paths: string[]) => Promise<void>;
}) {
  const { session } = useAuth();
  const urls = usePhotoUrls(paths);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(files: File[]) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      let next = paths;
      for (const f of files.slice(0, MAX_PHOTOS - paths.length)) {
        next = addPhotoPath(next, await uploadPhoto(f, session.user.id, scope));
      }
      await onChange(next);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {paths.map((p, i) => (
          <div key={p} className="relative">
            <div className="h-20 w-20 overflow-hidden rounded-lg bg-slate-100">
              {urls[p] && <img src={urls[p]} alt="" className="h-full w-full object-cover" />}
            </div>
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-navy-950 px-1 text-[10px] text-white">Principale</span>}
            <button
              type="button"
              className="absolute -right-1 -top-1 rounded-full bg-loss px-1.5 text-xs text-white"
              aria-label="Retirer la photo"
              onClick={() => {
                if (window.confirm('Retirer cette photo ?')) void onChange(paths.filter((x) => x !== p));
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {paths.length < MAX_PHOTOS && (
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          className="text-sm"
          onChange={(e) => void add(Array.from<File>(e.target.files ?? []))}
        />
      )}
      {busy && <p className="text-xs text-slate-500">Envoi en cours…</p>}
      {error && <p className="text-xs text-loss">{error}</p>}
      <p className="text-xs text-slate-500">{MAX_PHOTOS} photos maximum, réduites à 1024 px avant l'envoi dans votre espace privé.</p>
    </div>
  );
}
