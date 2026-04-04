import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { ModernSelect } from '../ui/ModernSelect';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';

type PostCategory = 'Training' | 'Nutrition' | 'Recovery' | 'Mindset';

type FeedCursor = {
  cursorCreatedAt: string;
  cursorId: number;
};

type BlogPost = {
  id: number;
  userId: number;
  category: PostCategory;
  description: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mediaAlt: string;
  createdAt: string | null;
  likes: number;
  comments: number;
  views: number;
};

type BlogPostApiRow = {
  id?: unknown;
  userId?: unknown;
  category?: unknown;
  description?: unknown;
  mediaType?: unknown;
  mediaUrl?: unknown;
  mediaAlt?: unknown;
  createdAt?: unknown;
  metrics?: {
    likes?: unknown;
    comments?: unknown;
    views?: unknown;
  };
};

const CATEGORY_OPTIONS: PostCategory[] = ['Training', 'Nutrition', 'Recovery', 'Mindset'];
const FEED_PAGE_LIMIT = 20;
const DESCRIPTION_MAX_LENGTH = 5000;

const MY_POSTS_I18N = {
  en: {
    title: 'My Blog Posts',
    missingUserId: 'Missing logged-in user id. Please login again.',
    failedLoadPosts: 'Failed to load your posts',
    failedLoadMorePosts: 'Failed to load more posts',
    descriptionRequired: 'Description is required.',
    descriptionTooLong: `Description is too long (max ${DESCRIPTION_MAX_LENGTH} chars).`,
    failedSaveChanges: 'Failed to save post changes',
    deleteConfirm: 'Delete this post? This cannot be undone.',
    failedDeletePost: 'Failed to delete post',
    loadingPosts: 'Loading your posts...',
    noPostsYet: 'You have not uploaded any blog posts yet.',
    likes: 'likes',
    comments: 'comments',
    views: 'views',
    edit: 'Edit',
    deleting: 'Deleting...',
    delete: 'Delete',
    loadingMore: 'Loading more posts...',
    loadMore: 'Load more posts',
    editPost: 'Edit Post',
    updateDescription: 'Update your post description...',
    cancel: 'Cancel',
    saving: 'Saving...',
    saveChanges: 'Save Changes',
    recently: 'Recently',
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgoSuffix: 'd ago',
  },
  ar: {
    title: 'منشوراتي',
    missingUserId: 'معرف المستخدم غير موجود. يرجى تسجيل الدخول مرة أخرى.',
    failedLoadPosts: 'فشل تحميل منشوراتك',
    failedLoadMorePosts: 'فشل تحميل المزيد من المنشورات',
    descriptionRequired: 'الوصف مطلوب.',
    descriptionTooLong: `الوصف طويل جدًا (الحد الأقصى ${DESCRIPTION_MAX_LENGTH} حرفًا).`,
    failedSaveChanges: 'فشل حفظ تعديلات المنشور',
    deleteConfirm: 'هل تريد حذف هذا المنشور؟ لا يمكن التراجع عن ذلك.',
    failedDeletePost: 'فشل حذف المنشور',
    loadingPosts: 'جارٍ تحميل منشوراتك...',
    noPostsYet: 'لم تقم برفع أي منشورات مدونة بعد.',
    likes: 'إعجاب',
    comments: 'تعليق',
    views: 'مشاهدة',
    edit: 'تعديل',
    deleting: 'جارٍ الحذف...',
    delete: 'حذف',
    loadingMore: 'جارٍ تحميل المزيد من المنشورات...',
    loadMore: 'تحميل المزيد من المنشورات',
    editPost: 'تعديل المنشور',
    updateDescription: 'حدّث وصف منشورك...',
    cancel: 'إلغاء',
    saving: 'جارٍ الحفظ...',
    saveChanges: 'حفظ التغييرات',
    recently: 'مؤخرًا',
    today: 'اليوم',
    yesterday: 'أمس',
    daysAgoSuffix: 'ي قبل',
  },
  it: {
    title: 'I Miei Post del Blog',
    missingUserId: 'ID utente mancante. Effettua di nuovo l accesso.',
    failedLoadPosts: 'Impossibile caricare i tuoi post',
    failedLoadMorePosts: 'Impossibile caricare altri post',
    descriptionRequired: 'La descrizione e obbligatoria.',
    descriptionTooLong: `La descrizione e troppo lunga (max ${DESCRIPTION_MAX_LENGTH} caratteri).`,
    failedSaveChanges: 'Impossibile salvare le modifiche al post',
    deleteConfirm: 'Eliminare questo post? Questa azione non puo essere annullata.',
    failedDeletePost: 'Impossibile eliminare il post',
    loadingPosts: 'Caricamento dei tuoi post...',
    noPostsYet: 'Non hai ancora caricato alcun post del blog.',
    likes: 'mi piace',
    comments: 'commenti',
    views: 'visualizzazioni',
    edit: 'Modifica',
    deleting: 'Eliminazione...',
    delete: 'Elimina',
    loadingMore: 'Caricamento di altri post...',
    loadMore: 'Carica altri post',
    editPost: 'Modifica Post',
    updateDescription: 'Aggiorna la descrizione del tuo post...',
    cancel: 'Annulla',
    saving: 'Salvataggio...',
    saveChanges: 'Salva Modifiche',
    recently: 'Di recente',
    today: 'Oggi',
    yesterday: 'Ieri',
    daysAgoSuffix: 'g fa',
  },
  de: {
    title: 'Meine Blogbeitraege',
    missingUserId: 'Benutzer-ID fehlt. Bitte melde dich erneut an.',
    failedLoadPosts: 'Deine Beitraege konnten nicht geladen werden',
    failedLoadMorePosts: 'Weitere Beitraege konnten nicht geladen werden',
    descriptionRequired: 'Eine Beschreibung ist erforderlich.',
    descriptionTooLong: `Die Beschreibung ist zu lang (max. ${DESCRIPTION_MAX_LENGTH} Zeichen).`,
    failedSaveChanges: 'Aenderungen am Beitrag konnten nicht gespeichert werden',
    deleteConfirm: 'Diesen Beitrag loeschen? Das kann nicht rueckgaengig gemacht werden.',
    failedDeletePost: 'Beitrag konnte nicht geloescht werden',
    loadingPosts: 'Deine Beitraege werden geladen...',
    noPostsYet: 'Du hast noch keine Blogbeitraege hochgeladen.',
    likes: 'Likes',
    comments: 'Kommentare',
    views: 'Aufrufe',
    edit: 'Bearbeiten',
    deleting: 'Wird geloescht...',
    delete: 'Loeschen',
    loadingMore: 'Weitere Beitraege werden geladen...',
    loadMore: 'Weitere Beitraege laden',
    editPost: 'Beitrag Bearbeiten',
    updateDescription: 'Aktualisiere deine Beitragsbeschreibung...',
    cancel: 'Abbrechen',
    saving: 'Wird gespeichert...',
    saveChanges: 'Aenderungen Speichern',
    recently: 'Kuerzlich',
    today: 'Heute',
    yesterday: 'Gestern',
    daysAgoSuffix: ' Tg her',
  },
} as const;

const toCount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const mapPost = (raw: BlogPostApiRow): BlogPost => {
  const categoryCandidate = String(raw?.category || '').trim() as PostCategory;
  return {
    id: Number(raw?.id || 0),
    userId: Number(raw?.userId || 0),
    category: CATEGORY_OPTIONS.includes(categoryCandidate) ? categoryCandidate : 'Recovery',
    description: String(raw?.description || ''),
    mediaType: raw?.mediaType === 'video' ? 'video' : 'image',
    mediaUrl: String(raw?.mediaUrl || ''),
    mediaAlt: String(raw?.mediaAlt || 'Post media'),
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : null,
    likes: toCount(raw?.metrics?.likes),
    comments: toCount(raw?.metrics?.comments),
    views: toCount(raw?.metrics?.views),
  };
};

const parseCursor = (value: unknown): FeedCursor | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const cursorCreatedAt = String(row.cursorCreatedAt || '').trim();
  const cursorId = Number(row.cursorId || 0);
  if (!cursorCreatedAt || !Number.isInteger(cursorId) || cursorId <= 0) return null;
  return { cursorCreatedAt, cursorId };
};

const resolveUserId = () => {
  const fromStorage = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  if (Number.isInteger(fromStorage) && fromStorage > 0) return fromStorage;

  try {
    const raw = localStorage.getItem('appUser') || localStorage.getItem('user') || '{}';
    const user = JSON.parse(raw);
    const inferred = Number(user?.id || 0);
    return Number.isInteger(inferred) && inferred > 0 ? inferred : null;
  } catch {
    return null;
  }
};

const formatRelativeDay = (value: string | null, language: AppLanguage) => {
  const copy = MY_POSTS_I18N[language] || MY_POSTS_I18N.en;
  if (!value) return copy.recently;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.recently;
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startNow - startThen) / (24 * 60 * 60 * 1000));
  if (dayDiff <= 0) return copy.today;
  if (dayDiff === 1) return copy.yesterday;
  if (dayDiff < 7) return `${dayDiff}${copy.daysAgoSuffix}`;
  const locale = language === 'ar' ? 'ar' : language === 'it' ? 'it-IT' : language === 'de' ? 'de-DE' : 'en-US';
  return date.toLocaleDateString(locale);
};

interface MyPostsScreenProps {
  onBack: () => void;
}

export function MyPostsScreen({ onBack }: MyPostsScreenProps) {
  const userId = useMemo(() => resolveUserId(), []);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = MY_POSTS_I18N[language] || MY_POSTS_I18N.en;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<PostCategory>('Recovery');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  const loadInitial = useCallback(async () => {
    if (!userId) {
      setError(copy.missingUserId);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.getBlogsFeed(userId, { limit: FEED_PAGE_LIMIT, authorId: userId });
      const loadedPosts = Array.isArray(response?.posts)
        ? response.posts.map((row: BlogPostApiRow) => mapPost(row))
        : [];
      const cursor = parseCursor(response?.nextCursor);
      setPosts(loadedPosts.filter((post) => post.id > 0 && post.userId === userId));
      setNextCursor(cursor);
      setHasMore(Boolean(response?.hasMore) && Boolean(cursor));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedLoadPosts);
    } finally {
      setLoading(false);
    }
  }, [copy.failedLoadPosts, copy.missingUserId, userId]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const response = await api.getBlogsFeed(userId, {
        limit: FEED_PAGE_LIMIT,
        authorId: userId,
        cursorCreatedAt: nextCursor.cursorCreatedAt,
        cursorId: nextCursor.cursorId,
      });
      const loadedPosts = Array.isArray(response?.posts)
        ? response.posts.map((row: BlogPostApiRow) => mapPost(row)).filter((post) => post.id > 0 && post.userId === userId)
        : [];
      const cursor = parseCursor(response?.nextCursor);
      setPosts((prev) => {
        const existing = new Set(prev.map((post) => post.id));
        const next = loadedPosts.filter((post) => !existing.has(post.id));
        return next.length ? [...prev, ...next] : prev;
      });
      setNextCursor(cursor);
      setHasMore(Boolean(response?.hasMore) && Boolean(cursor));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedLoadMorePosts);
    } finally {
      setLoadingMore(false);
    }
  }, [copy.failedLoadMorePosts, hasMore, loadingMore, nextCursor, userId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const openEdit = (post: BlogPost) => {
    setEditingPost(post);
    setEditDescription(post.description);
    setEditCategory(post.category);
    setEditError('');
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditingPost(null);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingPost || !userId || savingEdit) return;
    const description = editDescription.trim();
    if (!description) {
      setEditError(copy.descriptionRequired);
      return;
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setEditError(copy.descriptionTooLong);
      return;
    }

    setSavingEdit(true);
    setEditError('');
    setError('');
    try {
      const response = await api.updateBlogPost(editingPost.id, {
        userId,
        description,
        category: editCategory,
      });

      const updated = response?.post ? mapPost(response.post as BlogPostApiRow) : null;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === editingPost.id
            ? updated || { ...post, description, category: editCategory }
            : post,
        ),
      );
      setEditingPost(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : copy.failedSaveChanges);
    } finally {
      setSavingEdit(false);
    }
  };

  const deletePost = async (postId: number) => {
    if (!userId || deletingPostId) return;
    const confirmed = window.confirm(copy.deleteConfirm);
    if (!confirmed) return;

    setDeletingPostId(postId);
    setError('');
    try {
      await api.deleteBlogPost(postId, userId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      if (editingPost?.id === postId) {
        setEditingPost(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedDeletePost);
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 space-y-3">
        {error && (
          <Card className="!p-3 text-sm text-red-300 border border-red-400/30 bg-red-500/10">{error}</Card>
        )}

        {loading ? (
          <Card className="!p-3 text-sm text-text-secondary">{copy.loadingPosts}</Card>
        ) : posts.length === 0 ? (
          <Card className="!p-3 text-sm text-text-secondary">{copy.noPostsYet}</Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} className="!p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-text-secondary">{formatRelativeDay(post.createdAt, language)}</div>
                  <div className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-text-secondary">
                    {post.category}
                  </div>
                </div>

                {post.mediaUrl && (
                  post.mediaType === 'video' ? (
                    <video
                      src={post.mediaUrl}
                      className="block w-full rounded-xl border border-white/10 bg-black max-h-72 object-contain sm:max-h-80"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt={post.mediaAlt}
                      className="w-full rounded-xl border border-white/10 bg-black/20 max-h-72 object-contain"
                      loading="lazy"
                    />
                  )
                )}

                {post.description.trim() && (
                  <div className="text-sm text-white leading-relaxed whitespace-pre-wrap">{post.description}</div>
                )}

                <div className="text-xs text-text-tertiary">
                  {new Intl.NumberFormat(language === 'ar' ? 'ar' : language === 'it' ? 'it-IT' : language === 'de' ? 'de-DE' : 'en-US').format(post.likes)} {copy.likes} - {' '}
                  {new Intl.NumberFormat(language === 'ar' ? 'ar' : language === 'it' ? 'it-IT' : language === 'de' ? 'de-DE' : 'en-US').format(post.comments)} {copy.comments} - {' '}
                  {new Intl.NumberFormat(language === 'ar' ? 'ar' : language === 'it' ? 'it-IT' : language === 'de' ? 'de-DE' : 'en-US').format(post.views)} {copy.views}
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(post)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={14} />
                    {copy.edit}
                  </button>
                  <button
                    type="button"
                    disabled={deletingPostId === post.id}
                    onClick={() => { void deletePost(post.id); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-60"
                  >
                    {deletingPostId === post.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {deletingPostId === post.id ? copy.deleting : copy.delete}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!loading && posts.length > 0 && hasMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => { void loadMore(); }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-60"
          >
            {loadingMore ? copy.loadingMore : copy.loadMore}
          </button>
        )}
      </div>

      {editingPost && (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4 flex items-center justify-center"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-md bg-card border border-white/10 rounded-2xl p-4 space-y-3"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">{copy.editPost}</h3>

            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
              rows={5}
              placeholder={copy.updateDescription}
              className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
            />
            <div className="text-[11px] text-text-secondary text-right">
              {editDescription.length}/{DESCRIPTION_MAX_LENGTH}
            </div>

            <ModernSelect
              value={editCategory}
              onChange={(nextValue) => setEditCategory(nextValue as PostCategory)}
              options={CATEGORY_OPTIONS.map((category) => ({ value: category, label: category }))}
            />

            {editError && (
              <div className="text-sm text-red-300">{editError}</div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => { void saveEdit(); }}
                disabled={savingEdit || !editDescription.trim()}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {savingEdit ? copy.saving : copy.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
