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

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
        throw new Error('Failed to fetch marketing assets');
      }
      const data: AdminAssetListResponse = await response.json();
      setAssets(data.assets);
      setTotal(data.total);
      setTotalDownloads(data.totalDownloads);
      setCategoryCount(data.categoryCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
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
        throw new Error(data.error || 'Failed to delete asset');
      }
      setDeleteTarget(null);
      setSuccessMessage('Asset removed from Affiliate Media Kit.');
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchAssets();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete asset'
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
      setUploadError('Swipe copy content is required for this category');
      return;
    }
    if (!isSwipeCopy && !file) {
      setUploadError('A file is required for this asset category');
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
        throw new Error(data.error || 'Failed to publish marketing asset');
      }

      setIsUploadOpen(false);
      resetUploadForm();
      setSuccessMessage('Marketing asset uploaded and published to Media Kit.');
      setTimeout(() => setSuccessMessage(''), 4000);
      await fetchAssets();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to publish asset'
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
            Affiliate Media Kit & Creative Assets
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upload and distribute logos, mascot assets, ad banners and
            copywriting swipe files for affiliates
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
            Upload New Asset
          </Button>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Marketing Creative to Media Kit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="asset-title">Asset Title *</Label>
                  <Input
                    id="asset-title"
                    required
                    placeholder="e.g. Davin AI Mascot 3D High-Res Pack"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-category">Category *</Label>
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
                            {CATEGORY_LABELS[c]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-format">Format</Label>
                  <Input
                    id="asset-format"
                    placeholder="e.g. PNG, SVG"
                    value={format}
                    onChange={(e) => setFormat(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="asset-resolution">
                    Resolution / Dimensions
                  </Label>
                  <Input
                    id="asset-resolution"
                    placeholder="e.g. 512x512 or 1920x1080"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                </div>
              </div>

              {category === 'SWIPE_COPY' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="asset-copy-text">
                    Swipe File Copy Content
                  </Label>
                  <Textarea
                    id="asset-copy-text"
                    rows={4}
                    placeholder="Write the swipe copy template..."
                    value={copyText}
                    onChange={(e) => setCopyText(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="asset-file">File *</Label>
                  <Input
                    id="asset-file"
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.mp4,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports PNG, JPG, SVG, MP4, PDF up to 50MB
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
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Publish to Media Kit'}
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
                Published Assets
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
                Partner Downloads
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
                Asset Categories
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
                placeholder="Search marketing assets..."
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
                <SelectItem value="ALL">All Categories</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-sm text-muted-foreground">
            Showing {assets.length} of {total} assets
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
                      Asset Title
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                      Category
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                      Format
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                      Resolution / Size
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Downloads
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Actions
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
                        No marketing assets found
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
                                Updated: {formatDate(asset.updatedAt)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <Badge
                            variant="outline"
                            className="border-border bg-muted text-muted-foreground"
                          >
                            {CATEGORY_LABELS[asset.category]}
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
                            {asset.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyLink(asset.id, asset)}
                              title="Copy Asset Link"
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
                                  title="Delete Asset"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete &ldquo;{asset.title}&rdquo;?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the asset from the affiliate
                                    media kit and deletes its stored file. This
                                    cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                {deleteError && (
                                  <p className="text-sm text-red-500">
                                    {deleteError}
                                  </p>
                                )}
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isDeleting}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    disabled={isDeleting}
                                    onClick={() => void handleDelete()}
                                    className="hover:bg-destructive/90 bg-destructive text-white"
                                  >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
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
