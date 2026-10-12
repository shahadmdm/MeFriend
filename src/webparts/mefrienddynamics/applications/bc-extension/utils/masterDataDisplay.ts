export const normalizeMasterDataCode = (value?: string): string => (value || '').trim().toUpperCase();

export const formatMasterDataCodeAndName = (code?: string, name?: string): string => {
  const normalizedCode = (code || '').trim();
  const normalizedName = (name || '').trim();

  if (!normalizedCode) {
    return normalizedName;
  }

  return normalizedName ? `${normalizedCode} — ${normalizedName}` : normalizedCode;
};
