'use client';

/**
 * Admin Marketing Resources Page (Row 96, Session 9-8b)
 *
 * Ported from `seed-code/trading-conversational-ai-ui-pages-increment/app/
 * admin/resources/page.tsx` with DavinTrade tokens, bound to the real
 * `GET/POST /api/admin/resources` and `DELETE /api/admin/resources/[id]`
 * endpoints (shipped 2026-08-20). The seed page's own `AppHeader`/`AdminNav`
 * are dropped — `app/(dashboard)/admin/layout.tsx` already provides that
 * chrome for every admin page. The seed page's "CDN Delivery Status: Edge
 * Optimized" stat card is fabricated infrastructure status with no backing
 * data and is not ported (Zero Mock Data) -- 3 real stat cards instead of 4.
 * There is no PATCH/edit capability anywhere in this stack (route + service
 * layer only support GET/POST/DELETE) -- CONFIRM Finding 1 -- so the seed's
 * "Edit" affordance was never real to begin with and isn't ported either.
 *
 * @module app/(dashboard)/admin/resources/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  FolderDown,
  Upload,
  Trash2,
  Copy,
  Check,
  FileText,
  Layers,
  Download,
  Search,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type AssetCategory =
  | 'BRAND_LOGOS'
  | 'MASCOTS'
  | 'AD_BANNERS'
  | 'SWIPE_COPY'
  | 'DOCS';

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  BRAND_LOGOS: 'Brand Logos',
  MASCOTS: 'Mascots & Icons',
  AD_BANNERS: 'Ad Banners',
  SWIPE_COPY: 'Copywriting Swipes',
  DOCS: 'Guidelines & PDF',
};

const CATEGORY_LABEL_KEYS: Record<AssetCategory, string> = {
  BRAND_LOGOS: 'admin.resources.category_brand_logos',
  MASCOTS: 'admin.resources.category_mascots',
  AD_BANNERS: 'admin.resources.category_ad_banners',
  SWIPE_COPY: 'admin.resources.category_swipe_copy',
  DOCS: 'admin.resources.category_docs',
};

interface MarketingAsset {
  id: string;
  title: string;
  category: AssetCategory;
  format: string;
  resolution: string;
  fileUrl: string | null;
  fileSize: number | null;
  copyText: string | null;
  downloadCount: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

interface AdminAssetListResponse {
  assets: MarketingAsset[];
  total: number;
  page: number;
  limit: number;
  totalDownloads: number;
  categoryCount: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(asset: MarketingAsset): boolean {
  return (
    !!asset.fileUrl &&
    ['PNG', 'JPG', 'JPEG', 'SVG'].includes(asset.format.toUpperCase())
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminMarketingResourcesPage(): React.ReactElement {
  const { t, formatDate } = useLocale();
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'ALL'>(
    'ALL'
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<MarketingAsset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Upload form state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AssetCategory>('BRAND_LOGOS');
  const [format, setFormat] = useState('');
  const [resolution, setResolution] = useState('');
  const [copyText, setCopyText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchAssets = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);

      const response = await fetch(`/api/admin/resources?${params}`);
      if (!response.ok) {
        throw new Error(
          t(
            'admin.resources.error_fetch_assets',
            'Failed to fetch marketing assets'
          )
        );
      }
      const data: AdminAssetListResponse = await response.json();
      setAssets(data.assets);
      setTotal(data.total);
      setTotalDownloads(data.totalDownloads);
      setCategoryCount(data.categoryCount);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.resources.error_occurred', 'An error occurred')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchAssets(), 300);
    return () => clearTimeout(timer);
  }, [fetchAssets]);

  const handleCopyLink = (id: string, asset: MarketingAsset): void => {
    const text =
      asset.category === 'SWIPE_COPY'
        ? (asset.copyText ?? '')
        : asset.fileUrl
          ? new URL(asset.fileUrl, window.location.origin).toString()
          : '';
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/admin/resources/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error ||
            t('admin.resources.error_delete_asset', 'Failed to delete asset')
        );
      }
      setDeleteTarget(null);
      setSuccessMessage(
        t(
          'admin.resources.asset_removed_success',
          'Asset removed from Affiliate Media Kit.'
        )
      );
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchAssets();
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : t('admin.resources.error_delete_asset', 'Failed to delete asset')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const resetUploadForm = (): void => {
    setTitle('');
    setCategory('BRAND_LOGOS');
    setFormat('');
    setResolution('');
    setCopyText('');
    setFile(null);
    setUploadError(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) return;

    const isSwipeCopy = category === 'SWIPE_COPY';
    if (isSwipeCopy && !copyText.trim()) {
      setUploadError(
        t(
          'admin.resources.error_swipe_copy_required',
          'Swipe copy content is required for this category'
        )
      );
      return;
    }
    if (!isSwipeCopy && !file) {
      setUploadError(
        t(
          'admin.resources.error_file_required',
          'A file is required for this asset category'
        )
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.set('title', title.trim());
      formData.set('category', category);
      if (format.trim()) formData.set('format', format.trim());
      if (resolution.trim()) formData.set('resolution', resolution.trim());
      if (isSwipeCopy) {
        formData.set('copyText', copyText.trim());
      } else if (file) {
        formData.set('file', file);
      }

      const response = await fetch('/api/admin/resources', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error ||
            t(
              'admin.resources.error_publish_asset',
              'Failed to publish marketing asset'
            )
        );
      }

      setIsUploadOpen(false);
      resetUploadForm();
      setSuccessMessage(
        t(
          'admin.resources.asset_published_success',
          'Marketing asset uploaded and published to Media Kit.'
        )
      );
      setTimeout(() => setSuccessMessage(''), 4000);
      await fetchAssets();
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : t(
              'admin.resources.error_publish_asset_short',
              'Failed to publish asset'
            )
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t(
              'admin.resources.title',
              'Affiliate Media Kit & Creative Assets'
            )}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              'admin.resources.subtitle',
              'Upload and distribute logos, mascot assets, ad banners and copywriting swipe files for affiliates'
            )}
          </p>
        </div>

        <Dialog
          open={isUploadOpen}
          onOpenChange={(open) => {
            setIsUploadOpen(open);
            if (!open) resetUploadForm();
          }}
        >
          <Button onClick={() => setIsUploadOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            {t('admin.resources.upload_new_asset', 'Upload New Asset')}
          </Button>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t(
                  'admin.resources.upload_dialog_title',
                  'Upload Marketing Creative to Media Kit'
                )}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="asset-title">
                    {t('admin.resources.asset_title', 'Asset Title *')}
                  </Label>
                  <Input
                    id="asset-title"
                    required
                    placeholder={t(
                      'admin.resources.asset_title_placeholder',
                      'e.g. Davin AI Mascot 3D High-Res Pack'
                    )}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-category">
                    {t('admin.resources.category', 'Category *')}
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(value) =>
                      setCategory(value as AssetCategory)
                    }
                  >
                    <SelectTrigger id="asset-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map(
                        (c) => (
                          <SelectItem key={c} value={c}>
                            {t(CATEGORY_LABEL_KEYS[c], CATEGORY_LABELS[c])}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-format">
                    {t('admin.resources.format', 'Format')}
                  </Label>
                  <Input
                    id="asset-format"
                    placeholder={t(
                      'admin.resources.format_placeholder',
                      'e.g. PNG, SVG'
                    )}
                    value={format}
                    onChange={(e) => setFormat(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="asset-resolution">
                    {t(
                      'admin.resources.resolution_dimensions',
                      'Resolution / Dimensions'
                    )}
                  </Label>
                  <Input
                    id="asset-resolution"
                    placeholder={t(
                      'admin.resources.resolution_placeholder',
                      'e.g. 512x512 or 1920x1080'
                    )}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                </div>
              </div>

              {category === 'SWIPE_COPY' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="asset-copy-text">
                    {t(
                      'admin.resources.swipe_file_copy_content',
                      'Swipe File Copy Content'
                    )}
                  </Label>
                  <Textarea
                    id="asset-copy-text"
                    rows={4}
                    placeholder={t(
                      'admin.resources.swipe_copy_placeholder',
                      'Write the swipe copy template...'
                    )}
                    value={copyText}
                    onChange={(e) => setCopyText(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="asset-file">
                    {t('admin.resources.file', 'File *')}
                  </Label>
                  <Input
                    id="asset-file"
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.mp4,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'admin.resources.file_support_note',
                      'Supports PNG, JPG, SVG, MP4, PDF up to 50MB'
                    )}
                  </p>
                </div>
              )}

              {uploadError && (
                <p className="text-sm text-red-500">{uploadError}</p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsUploadOpen(false)}
                >
                  {t('Cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading
                    ? t('admin.resources.uploading', 'Uploading...')
                    : t(
                        'admin.resources.publish_to_media_kit',
                        'Publish to Media Kit'
                      )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('admin.resources.published_assets', 'Published Assets')}
              </p>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {total}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FolderDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('admin.resources.partner_downloads', 'Partner Downloads')}
              </p>
              <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {totalDownloads.toLocaleString()}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Download className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('admin.resources.asset_categories', 'Asset Categories')}
              </p>
              <div className="mt-1 text-2xl font-bold text-primary">
                {categoryCount}
              </div>
            </div>
            <div className="border-primary/30 bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl border text-primary">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t(
                  'admin.resources.search_placeholder',
                  'Search marketing assets...'
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter(value as AssetCategory | 'ALL')
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('admin.resources.all_categories', 'All Categories')}
                </SelectItem>
                {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(CATEGORY_LABEL_KEYS[c], CATEGORY_LABELS[c])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-sm text-muted-foreground">
            {t(
              'admin.resources.showing_x_of_y_assets',
              'Showing {shown} of {total} assets'
            )
              .replace('{shown}', String(assets.length))
              .replace('{total}', String(total))}
          </span>
        </CardContent>
      </Card>

      {/* Asset Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.resources.asset_title_header', 'Asset Title')}
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                      {t('admin.resources.category_header', 'Category')}
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                      {t('admin.resources.format_header', 'Format')}
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                      {t(
                        'admin.resources.resolution_size',
                        'Resolution / Size'
                      )}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.resources.downloads', 'Downloads')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.resources.status', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('admin.resources.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        {t(
                          'admin.resources.no_assets_found',
                          'No marketing assets found'
                        )}
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => (
                      <tr
                        key={asset.id}
                        className="border-border/50 hover:bg-accent/30 border-b transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {isPreviewable(asset) && asset.fileUrl ? (
                              <div className="bg-accent/50 relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                                <Image
                                  src={asset.fileUrl}
                                  alt={asset.title}
                                  fill
                                  className="object-contain p-1"
                                />
                              </div>
                            ) : (
                              <div className="bg-accent/50 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-amber-600 dark:text-amber-400">
                                <FileText className="h-5 w-5" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-foreground">
                                {asset.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t(
                                  'admin.resources.updated_prefix',
                                  'Updated:'
                                )}{' '}
                                {formatDate(asset.updatedAt)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <Badge
                            variant="outline"
                            className="border-border bg-muted text-muted-foreground"
                          >
                            {t(
                              CATEGORY_LABEL_KEYS[asset.category],
                              CATEGORY_LABELS[asset.category]
                            )}
                          </Badge>
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-sm font-medium text-amber-600 dark:text-amber-400 lg:table-cell">
                          {asset.format}
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-sm text-muted-foreground lg:table-cell">
                          {asset.resolution} &bull;{' '}
                          {formatFileSize(asset.fileSize)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {asset.downloadCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10">
                            {t(
                              `admin.resources.asset_status_${asset.status.toLowerCase()}`,
                              asset.status
                            )}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyLink(asset.id, asset)}
                              title={t(
                                'admin.resources.copy_asset_link',
                                'Copy Asset Link'
                              )}
                            >
                              {copiedId === asset.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            <AlertDialog
                              open={deleteTarget?.id === asset.id}
                              onOpenChange={(open) => {
                                if (!open) {
                                  setDeleteTarget(null);
                                  setDeleteError(null);
                                }
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
                                  onClick={() => setDeleteTarget(asset)}
                                  title={t(
                                    'admin.resources.delete_asset_title',
                                    'Delete Asset'
                                  )}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t(
                                      'admin.resources.delete_asset_confirm',
                                      'Delete "{title}"?'
                                    ).replace('{title}', asset.title)}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t(
                                      'admin.resources.delete_asset_warning',
                                      'This removes the asset from the affiliate media kit and deletes its stored file. This cannot be undone.'
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                {deleteError && (
                                  <p className="text-sm text-red-500">
                                    {deleteError}
                                  </p>
                                )}
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isDeleting}>
                                    {t('Cancel', 'Cancel')}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    disabled={isDeleting}
                                    onClick={() => void handleDelete()}
                                    className="hover:bg-destructive/90 bg-destructive text-white"
                                  >
                                    {isDeleting
                                      ? t(
                                          'admin.resources.deleting',
                                          'Deleting...'
                                        )
                                      : t(
                                          'admin.disbursement.delete',
                                          'Delete'
                                        )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
