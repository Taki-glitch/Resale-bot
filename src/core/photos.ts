/** Chemins de photos : un dossier par utilisateur, reflété par les politiques de stockage Supabase. */
export const MAX_PHOTOS = 6;

export function photoPath(userId: string, scope: string, uniqueId: string): string {
  return `${userId}/${scope}/${uniqueId}.jpg`;
}

export function isOwnPhotoPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..');
}

export function addPhotoPath(current: string[], path: string): string[] {
  if (current.includes(path)) return current;
  return [...current, path].slice(0, MAX_PHOTOS);
}
