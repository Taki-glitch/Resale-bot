import { db } from './db.ts';
import { fileToJpegBlob } from '../lib/images.ts';
import { photoPath } from '../core/photos.ts';

const BUCKET = 'photos';
const cache = new Map<string, { url: string; at: number }>();
const TTL_MS = 50 * 60 * 1000; // les liens signés durent 1 h

/** Envoie une photo réduite dans le compartiment privé « photos » (dossier de l'utilisateur) et renvoie son chemin. */
export async function uploadPhoto(file: File, userId: string, scope: string): Promise<string> {
  const blob = await fileToJpegBlob(file);
  const path = photoPath(userId, scope, crypto.randomUUID());
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Liens temporaires d'affichage (mis en cache) ; un chemin illisible est simplement ignoré. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of paths) {
    const hit = cache.get(p);
    if (hit && now - hit.at < TTL_MS) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length > 0) {
    const { data, error } = await db().storage.from(BUCKET).createSignedUrls(missing, 3600);
    if (!error) {
      for (const row of (data ?? []) as { path: string; signedUrl: string | null }[]) {
        if (row.signedUrl) {
          cache.set(row.path, { url: row.signedUrl, at: now });
          out[row.path] = row.signedUrl;
        }
      }
    }
  }
  return out;
}
