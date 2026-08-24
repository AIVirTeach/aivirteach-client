type PendingAsset = { file: File; previewUrl: string };

const pendingAssets = new Map<string, PendingAsset>();

export function registerPendingAsset(assetId: string, file: File) {
  const existing = pendingAssets.get(assetId);
  if (existing) URL.revokeObjectURL(existing.previewUrl);
  const previewUrl = URL.createObjectURL(file);
  pendingAssets.set(assetId, { file, previewUrl });
  return previewUrl;
}

export function getPendingAssetPreview(assetId: string) {
  return pendingAssets.get(assetId)?.previewUrl;
}

export function getPendingAssetFile(assetId: string) {
  return pendingAssets.get(assetId)?.file;
}

export function removePendingAsset(assetId: string) {
  const existing = pendingAssets.get(assetId);
  if (existing) URL.revokeObjectURL(existing.previewUrl);
  pendingAssets.delete(assetId);
}
