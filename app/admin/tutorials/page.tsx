'use client';

/**
 * Admin Academy Tutorials Page
 *
 * CRUD console for the public /academy video tutorials — mirrors
 * app/admin/resources/page.tsx's shape (stats row, search/filter bar,
 * dialog form, table with actions), but simpler: no file upload (a plain
 * YouTube URL), and — unlike the media-kit feature — real edit support,
 * since there's no file-replace complexity here.
 *
 * @module app/admin/tutorials/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Trash2,
  Pencil,
  Check,
  Eye,
  Layers,
  Search,
  Star,
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
} from '@/lib/tutorials/youtube';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type TutorialCategory =
  | 'GETTING_STARTED'
  | 'PLATFORM_WALKTHROUGH'
  | 'TRADING_STRATEGIES'
  | 'RISK_MANAGEMENT'
  | 'MARKET_ANALYSIS';

type TutorialStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

const CATEGORY_LABEL_KEYS: Record<TutorialCategory, string> = {
  GETTING_STARTED: 'academy.category.getting_started',
  PLATFORM_WALKTHROUGH: 'academy.category.platform_walkthrough',
  TRADING_STRATEGIES: 'academy.category.trading_strategies',
  RISK_MANAGEMENT: 'academy.category.risk_management',
  MARKET_ANALYSIS: 'academy.category.market_analysis',
};

const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  GETTING_STARTED: 'Getting Started',
  PLATFORM_WALKTHROUGH: 'Platform Walkthrough',
  TRADING_STRATEGIES: 'Trading Strategies',
  RISK_MANAGEMENT: 'Risk Management',
  MARKET_ANALYSIS: 'Market Analysis',
};

interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  category: TutorialCategory;
  featured: boolean;
  viewCount: number;
  status: TutorialStatus;
  createdAt: string;
  updatedAt: string;
}

interface AdminTutorialListResponse {
  tutorials: Tutorial[];
  total: number;
  page: number;
  limit: number;
  totalViews: number;
  categoryCount: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminTutorialsPage(): React.ReactElement {
  const { t, formatDate } = useLocale();
  const categoryLabel = (cat: TutorialCategory): string =>
    t(CATEGORY_LABEL_KEYS[cat], CATEGORY_LABELS[cat]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [total, setTotal] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    TutorialCategory | 'ALL'
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<TutorialStatus | 'ALL'>(
    'ALL'
  );

  const [successMessage, setSuccessMessage] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Tutorial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add/Edit dialog state (shared form -- editingTutorial === null means "Add")
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [category, setCategory] = useState<TutorialCategory>('GETTING_STARTED');
  const [featured, setFeatured] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Inline status-toggle state (per-row, so only the clicked badge shows a spinner)
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTutorials = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const response = await fetch(`/api/admin/tutorials?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tutorials');
      }
      const data: AdminTutorialListResponse = await response.json();
      setTutorials(data.tutorials);
      setTotal(data.total);
      setTotalViews(data.totalViews);
      setCategoryCount(data.categoryCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchTutorials(), 300);
    return () => clearTimeout(timer);
  }, [fetchTutorials]);

  const resetForm = (): void => {
    setEditingTutorial(null);
    setTitle('');
    setDescription('');
    setYoutubeUrl('');
    setCategory('GETTING_STARTED');
    setFeatured(false);
    setSubmitError(null);
  };

  const openAddDialog = (): void => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (tutorial: Tutorial): void => {
    setEditingTutorial(tutorial);
    setTitle(tutorial.title);
    setDescription(tutorial.description);
    setYoutubeUrl(tutorial.youtubeUrl);
    setCategory(tutorial.category);
    setFeatured(tutorial.featured);
    setSubmitError(null);
    setIsDialogOpen(true);
  };

  const previewVideoId = extractYouTubeVideoId(youtubeUrl);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        youtubeUrl: youtubeUrl.trim(),
        category,
        featured,
      };

      const response = await fetch(
        editingTutorial
          ? `/api/admin/tutorials/${editingTutorial.id}`
          : '/api/admin/tutorials',
        {
          method: editingTutorial ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save tutorial');
      }

      setIsDialogOpen(false);
      resetForm();
      setSuccessMessage(
        editingTutorial
          ? t('academy.admin.tutorial_updated', 'Tutorial updated.')
          : t(
              'academy.admin.tutorial_published',
              'Tutorial published to the Academy.'
            )
      );
      setTimeout(() => setSuccessMessage(''), 4000);
      await fetchTutorials();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save tutorial'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (tutorial: Tutorial): Promise<void> => {
    const nextStatus: TutorialStatus =
      tutorial.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    setTogglingId(tutorial.id);
    try {
      const response = await fetch(`/api/admin/tutorials/${tutorial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      await fetchTutorials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/admin/tutorials/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete tutorial');
      }
      setDeleteTarget(null);
      setSuccessMessage(
        t(
          'academy.admin.tutorial_removed',
          'Tutorial removed from the Academy.'
        )
      );
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchTutorials();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete tutorial'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t('academy.admin.title', 'Academy Tutorials')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              'academy.admin.subtitle',
              'Curate the YouTube trading & platform tutorials shown on the public /academy pages'
            )}
          </p>
        </div>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <Button onClick={openAddDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('academy.admin.add_tutorial', 'Add Tutorial')}
          </Button>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTutorial
                  ? t('academy.admin.edit_tutorial', 'Edit Tutorial')
                  : t(
                      'academy.admin.publish_new_tutorial',
                      'Publish New Tutorial'
                    )}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tutorial-title">
                  {t('academy.admin.title_field', 'Title')} *
                </Label>
                <Input
                  id="tutorial-title"
                  required
                  placeholder={t(
                    'academy.admin.title_placeholder',
                    'e.g. Reading the Order Book Like a Pro'
                  )}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tutorial-url">
                  {t('academy.admin.youtube_url', 'YouTube URL')} *
                </Label>
                <Input
                  id="tutorial-url"
                  required
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                {youtubeUrl.trim() &&
                  (previewVideoId ? (
                    <div className="bg-accent/30 flex items-center gap-3 rounded-md border border-border p-2">
                      <img
                        src={getYouTubeThumbnailUrl(previewVideoId)}
                        alt={t(
                          'academy.admin.thumbnail_preview_alt',
                          'Thumbnail preview'
                        )}
                        className="h-12 w-20 rounded object-cover"
                      />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t(
                          'academy.admin.video_id_recognized',
                          'Video ID recognized:'
                        )}{' '}
                        {previewVideoId}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-red-500">
                      {t(
                        'academy.admin.invalid_youtube_url',
                        "Doesn't look like a valid YouTube URL yet"
                      )}
                    </p>
                  ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tutorial-description">
                  {t('Description')} *
                </Label>
                <Textarea
                  id="tutorial-description"
                  required
                  rows={3}
                  placeholder={t(
                    'academy.admin.description_placeholder',
                    'What will viewers learn from this video?'
                  )}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tutorial-category">
                    {t('academy.admin.category_field', 'Category')} *
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(value) =>
                      setCategory(value as TutorialCategory)
                    }
                  >
                    <SelectTrigger id="tutorial-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as TutorialCategory[]).map(
                        (c) => (
                          <SelectItem key={c} value={c}>
                            {categoryLabel(c)}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="tutorial-featured"
                    checked={featured}
                    onCheckedChange={(checked) => setFeatured(checked === true)}
                  />
                  <Label htmlFor="tutorial-featured" className="font-normal">
                    {t(
                      'academy.admin.feature_at_top',
                      'Feature at top of Academy'
                    )}
                  </Label>
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-red-500">{submitError}</p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t('Cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? t('Saving...')
                    : editingTutorial
                      ? t('Save Changes')
                      : t(
                          'academy.admin.publish_to_academy',
                          'Publish to Academy'
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
                {t('academy.admin.total_tutorials', 'Total Tutorials')}
              </p>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {total}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('academy.admin.total_views', 'Total Views')}
              </p>
              <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {totalViews.toLocaleString()}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Eye className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('academy.admin.categories', 'Categories')}
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
                  'academy.admin.search_tutorials',
                  'Search tutorials...'
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter(value as TutorialCategory | 'ALL')
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('academy.admin.all_categories', 'All Categories')}
                </SelectItem>
                {(Object.keys(CATEGORY_LABELS) as TutorialCategory[]).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as TutorialStatus | 'ALL')
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('academy.admin.all_statuses', 'All Statuses')}
                </SelectItem>
                <SelectItem value="ACTIVE">{t('Active')}</SelectItem>
                <SelectItem value="ARCHIVED">
                  {t('academy.admin.archived', 'Archived')}
                </SelectItem>
                <SelectItem value="DRAFT">
                  {t('academy.admin.draft', 'Draft')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <span className="text-sm text-muted-foreground">
            {t(
              'academy.admin.showing_x_of_y_tutorials',
              'Showing {shown} of {total} tutorials'
            )
              .replace('{shown}', String(tutorials.length))
              .replace('{total}', String(total))}
          </span>
        </CardContent>
      </Card>

      {/* Tutorials Table */}
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
                      {t('academy.admin.tutorial_col', 'Tutorial')}
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                      {t('academy.category_col', 'Category')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('academy.admin.views_col', 'Views')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('Status')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tutorials.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        {t(
                          'academy.admin.no_tutorials_found',
                          'No tutorials found'
                        )}
                      </td>
                    </tr>
                  ) : (
                    tutorials.map((tutorial) => (
                      <tr
                        key={tutorial.id}
                        className="border-border/50 hover:bg-accent/30 border-b transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={getYouTubeThumbnailUrl(
                                tutorial.youtubeVideoId
                              )}
                              alt={tutorial.title}
                              className="h-10 w-16 shrink-0 rounded object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                {tutorial.featured && (
                                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                )}
                                {tutorial.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t('academy.admin.updated', 'Updated:')}{' '}
                                {formatDate(tutorial.updatedAt)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <Badge
                            variant="outline"
                            className="border-border bg-muted text-muted-foreground"
                          >
                            {categoryLabel(tutorial.category)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {tutorial.viewCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={togglingId === tutorial.id}
                            onClick={() => void handleToggleStatus(tutorial)}
                            title={t(
                              'academy.admin.toggle_active_archived',
                              'Click to toggle Active/Archived'
                            )}
                          >
                            <Badge
                              className={
                                tutorial.status === 'ACTIVE'
                                  ? 'cursor-pointer bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                  : 'cursor-pointer bg-muted text-muted-foreground hover:bg-accent'
                              }
                            >
                              {togglingId === tutorial.id
                                ? '...'
                                : tutorial.status}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(tutorial)}
                              title={t(
                                'academy.admin.edit_tutorial_title',
                                'Edit Tutorial'
                              )}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <AlertDialog
                              open={deleteTarget?.id === tutorial.id}
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
                                  onClick={() => setDeleteTarget(tutorial)}
                                  title={t(
                                    'academy.admin.delete_tutorial_title',
                                    'Delete Tutorial'
                                  )}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t(
                                      'academy.admin.delete_confirm_title',
                                      'Delete "{title}"?'
                                    ).replace('{title}', tutorial.title)}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t(
                                      'academy.admin.delete_confirm_body',
                                      'This removes the tutorial from the public Academy pages. This cannot be undone.'
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
                                    {t('Cancel')}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    disabled={isDeleting}
                                    onClick={() => void handleDelete()}
                                    className="hover:bg-destructive/90 bg-destructive text-white"
                                  >
                                    {isDeleting
                                      ? t(
                                          'academy.admin.deleting',
                                          'Deleting...'
                                        )
                                      : t('Delete')}
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
