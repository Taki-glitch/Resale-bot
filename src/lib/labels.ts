import type { Platform, SourceKind } from '../types.ts';

export const PLATFORM_LABEL: Record<Platform, string> = {
  vinted: 'Vinted',
  leboncoin: 'Leboncoin',
  manual: 'Manuel',
  other: 'Autre',
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  manual: 'Saisie manuelle',
  import: 'Import',
  authorized_source: 'Source autorisée',
};
