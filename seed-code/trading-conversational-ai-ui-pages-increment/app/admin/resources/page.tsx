'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FolderDown,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Eye,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Download,
  Share2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale } from '@/lib/context/locale-context';

interface MarketingAsset {
  id: string;
  title: string;
  category: 'BRAND_LOGOS' | 'MASCOTS' | 'AD_BANNERS' | 'SWIPE_COPY' | 'DOCS';
  format: string;
  resolution: string;
  size: string;
  downloadUrl: string;
  previewUrl: string;
  downloadCount: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  updatedAt: string;
}

export default function AdminMarketingResourcesPage() {
  const { t } = useLocale();

  const [assets, setAssets] = useState<MarketingAsset[]>([
    {
      id: 'asset-1',
      title: 'Davin AI App Icon (Transparent 512x512)',
      category: 'MASCOTS',
      format: 'PNG',
      resolution: '512x512',
      size: '240 KB',
      downloadUrl: '/davintrade-ai-icon.png',
      previewUrl: '/davintrade-ai-icon.png',
      downloadCount: 1420,
      status: 'ACTIVE',
      updatedAt: '2026-08-15',
    },
    {
      id: 'asset-2',
      title: 'DavinTrade Official Horizontal Banner Logo',
      category: 'BRAND_LOGOS',
      format: 'JPG',
      resolution: '1200x400',
      size: '480 KB',
      downloadUrl: '/DavinTrade_Logo.jpg',
      previewUrl: '/DavinTrade_Logo.jpg',
      downloadCount: 980,
      status: 'ACTIVE',
      updatedAt: '2026-08-12',
    },
    {
      id: 'asset-3',
      title: 'Scalable Vector SVG Brand Pack',
      category: 'BRAND_LOGOS',
      format: 'SVG',
      resolution: 'Vector',
      size: '45 KB',
      downloadUrl: '/icon.svg',
      previewUrl: '/icon.svg',
      downloadCount: 650,
      status: 'ACTIVE',
      updatedAt: '2026-08-01',
    },
    {
      id: 'asset-4',
      title: 'Telegram & Discord High-Converting Alert Swipe',
      category: 'SWIPE_COPY',
      format: 'TXT',
      resolution: 'Text Copy',
      size: '1.2 KB',
      downloadUrl: '#',
      previewUrl: '',
      downloadCount: 2340,
      status: 'ACTIVE',
      updatedAt: '2026-08-16',
    },
  ]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Form state for uploading new marketing asset
  const [title, setTitle] = useState('');
  const [category, setCategory] =
    useState<MarketingAsset['category']>('BRAND_LOGOS');
  const [format, setFormat] = useState('PNG');
  const [resolution, setResolution] = useState('1920x1080');
  const [copyTextContent, setCopyTextContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleCopyLink = (id: string, url: string) => {
    const full = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    navigator.clipboard.writeText(full);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('Are you sure you want to remove this marketing asset?'))) {
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSuccessMessage(t('Asset removed from Affiliate Media Kit.'));
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsUploading(true);

    setTimeout(() => {
      const newAsset: MarketingAsset = {
        id: `asset-${Date.now()}`,
        title,
        category,
        format,
        resolution,
        size: '320 KB',
        downloadUrl:
          category === 'SWIPE_COPY' ? '#' : '/davintrade-ai-icon.png',
        previewUrl: category === 'SWIPE_COPY' ? '' : '/davintrade-ai-icon.png',
        downloadCount: 0,
        status: 'ACTIVE',
        updatedAt: new Date().toISOString().slice(0, 10),
      };

      setAssets([newAsset, ...assets]);
      setIsUploading(false);
      setIsUploadModalOpen(false);
      setTitle('');
      setCopyTextContent('');
      setSuccessMessage(
        t('Marketing asset uploaded and published to Affiliate Media Kit.')
      );
      setTimeout(() => setSuccessMessage(''), 4000);
    }, 600);
  };

  const filteredAssets = assets
    .filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    .filter((a) => categoryFilter === 'ALL' || a.category === categoryFilter);

  const totalDownloads = assets.reduce(
    (acc, cur) => acc + cur.downloadCount,
    0
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Marketing Resources & Media Kit Manager')}
        subtitle={t(
          'Upload & Distribute Logos, Mascot Assets, Ad Banners & Copywriting Swipe Files for Affiliates'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* Top Breadcrumb & Actions */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <Link
                href="/admin"
                className="transition-colors hover:text-amber-300"
              >
                {t('Admin')}
              </Link>
              <span>/</span>
              <span className="font-bold text-amber-400">
                {t('Marketing Resources')}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-100 sm:text-3xl">
              {t('Affiliate Media Kit & Creative Assets')}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/affiliate/resources" target="_blank">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-800 bg-[#0a0d16] text-xs text-slate-300 hover:bg-slate-800"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                {t('Preview Partner Media Kit')}
              </Button>
            </Link>

            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {t('Upload New Asset')}
            </Button>
          </div>
        </div>

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-800/80 bg-[#090c14] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {t('Published Assets')}
                </p>
                <div className="mt-1 font-mono text-2xl font-extrabold text-slate-100">
                  {assets.length}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <FolderDown className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {t('Available live to all verified affiliates')}
            </p>
          </Card>

          <Card className="border-slate-800/80 bg-[#090c14] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {t('Partner Downloads')}
                </p>
                <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-400">
                  {totalDownloads.toLocaleString()}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <Download className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {t('Total creative downloads & swipes')}
            </p>
          </Card>

          <Card className="border-slate-800/80 bg-[#090c14] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {t('Asset Categories')}
                </p>
                <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-400">
                  5
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {t('Logos, Mascots, Banners, Copy, PDF')}
            </p>
          </Card>

          <Card className="border-slate-800/80 bg-[#090c14] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {t('CDN Delivery Status')}
                </p>
                <div className="mt-1 flex items-center gap-2 font-mono text-base font-extrabold text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  {t('Edge Optimized')}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {t('Global high-speed media distribution')}
            </p>
          </Card>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800/80 bg-[#090c14] p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search marketing assets...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-slate-800 bg-[#06080e] pl-9 text-xs text-slate-200"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-800 bg-[#06080e] px-3 text-xs text-slate-200"
            >
              <option value="ALL">{t('All Categories')}</option>
              <option value="BRAND_LOGOS">{t('Brand Logos')}</option>
              <option value="MASCOTS">{t('Mascots & Icons')}</option>
              <option value="AD_BANNERS">{t('Ad Banners')}</option>
              <option value="SWIPE_COPY">{t('Copywriting Swipes')}</option>
              <option value="DOCS">{t('Guidelines & PDF')}</option>
            </select>
          </div>

          <span className="text-xs text-slate-500">
            {t('Showing')} {filteredAssets.length} {t('of')} {assets.length}{' '}
            {t('assets')}
          </span>
        </div>

        {/* Upload Modal Drawer / Card */}
        {isUploadModalOpen && (
          <Card className="space-y-4 border-amber-500/40 bg-[#090d18] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">
                  {t('Upload Marketing Creative to Media Kit')}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {t('Cancel')}
              </Button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Asset Title / Description')} *
                  </Label>
                  <Input
                    required
                    placeholder="e.g. Davin AI Mascot 3D High-Res Pack"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-slate-800 bg-[#06080e] text-xs text-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Asset Category')} *
                  </Label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as MarketingAsset['category'])
                    }
                    className="h-9 w-full rounded-md border border-slate-800 bg-[#06080e] px-3 text-xs text-slate-200"
                  >
                    <option value="BRAND_LOGOS">
                      {t('Brand Logos & Vector Marks')}
                    </option>
                    <option value="MASCOTS">{t('AI Mascots & Icons')}</option>
                    <option value="AD_BANNERS">
                      {t('Social Media & Display Ad Banners')}
                    </option>
                    <option value="SWIPE_COPY">
                      {t('Copywriting Swipes (Telegram, Discord, Video)')}
                    </option>
                    <option value="DOCS">
                      {t('Partner Guidelines & Brand Deck')}
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('File Format')}
                  </Label>
                  <Input
                    placeholder="e.g. PNG / SVG / JPG / MP4"
                    value={format}
                    onChange={(e) => setFormat(e.target.value.toUpperCase())}
                    className="border-slate-800 bg-[#06080e] font-mono text-xs text-slate-200 uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Resolution / Dimensions')}
                  </Label>
                  <Input
                    placeholder="e.g. 512x512 or 1920x1080"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="border-slate-800 bg-[#06080e] font-mono text-xs text-slate-200"
                  />
                </div>
              </div>

              {category === 'SWIPE_COPY' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Swipe File Copy Content')}
                  </Label>
                  <Textarea
                    rows={4}
                    placeholder="Write the swipe copy template with tracking parameters..."
                    value={copyTextContent}
                    onChange={(e) => setCopyTextContent(e.target.value)}
                    className="border-slate-800 bg-[#06080e] font-mono text-xs text-slate-200"
                  />
                </div>
              ) : (
                <div className="border-slate-750 rounded-xl border-2 border-dashed bg-[#06080e] p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-amber-400 opacity-80" />
                  <p className="mt-2 text-xs font-semibold text-slate-200">
                    {t('Drag and drop your image, vector, or media file here')}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {t('Supports PNG, JPG, SVG, MP4, PDF up to 50MB')}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-xs text-slate-400"
                >
                  {t('Cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isUploading}
                  className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
                >
                  {isUploading ? t('Uploading...') : t('Publish to Media Kit')}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Asset Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Asset Title')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Category')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Format')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Resolution / Size')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Downloads')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {asset.previewUrl ? (
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-[#06080e]">
                          <Image
                            src={asset.previewUrl}
                            alt={asset.title}
                            fill
                            className="object-contain p-1"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#06080e] text-amber-400">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-200">
                          {asset.title}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {t('Updated')}: {asset.updatedAt}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800/60 text-[10px] text-slate-300"
                    >
                      {asset.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {asset.format}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {asset.resolution} • {asset.size}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {asset.downloadCount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {asset.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyLink(asset.id, asset.downloadUrl)
                        }
                        className="h-8 text-xs text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                        title={t('Copy Asset URL')}
                      >
                        {copiedId === asset.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(asset.id)}
                        className="h-8 text-xs text-slate-400 hover:bg-rose-950/40 hover:text-rose-400"
                        title={t('Delete Asset')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
