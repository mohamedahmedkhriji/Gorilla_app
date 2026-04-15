import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Heart, Loader2, MessageSquare, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { ModernSelect } from '../ui/ModernSelect';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';

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
const LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  en: 'en-US',
  ar: 'ar',
  it: 'it-IT',
  fr: 'fr-FR',
  de: 'de-DE',
};
const SURFACE_CARD_CLASS = 'rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-sm';
const META_PILL_CLASS = 'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-text-secondary';
const ACTION_BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-60';

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
  fr: {
    title: 'Mes Articles de Blog',
    missingUserId: 'Utilisateur connecte introuvable. Merci de te reconnecter.',
    failedLoadPosts: 'Impossible de charger tes publications',
    failedLoadMorePosts: 'Impossible de charger plus de publications',
    descriptionRequired: 'La description est obligatoire.',
    descriptionTooLong: `La description est trop longue (max ${DESCRIPTION_MAX_LENGTH} caracteres).`,
    failedSaveChanges: 'Impossible d enregistrer les modifications de la publication',
    deleteConfirm: 'Supprimer cette publication ? Cette action est definitive.',
    failedDeletePost: 'Impossible de supprimer la publication',
    loadingPosts: 'Chargement de tes publications...',
    noPostsYet: 'Tu n as encore publie aucun article de blog.',
    likes: 'j aime',
    comments: 'commentaires',
    views: 'vues',
    edit: 'Modifier',
    deleting: 'Suppression...',
    delete: 'Supprimer',
    loadingMore: 'Chargement de plus de publications...',
    loadMore: 'Charger plus de publications',
    editPost: 'Modifier la publication',
    updateDescription: 'Met a jour la description de ta publication...',
    cancel: 'Annuler',
    saving: 'Enregistrement...',
    saveChanges: 'Enregistrer les modifications',
    recently: 'Recemment',
    today: 'Aujourd hui',
    yesterday: 'Hier',
    daysAgoSuffix: ' j',
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
  const copy = MY_POSTS_I18N[language as keyof typeof MY_POSTS_I18N] || MY_POSTS_I18N.en;
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
  const locale = language === 'ar' ? 'ar' : language === 'it' ? 'it-IT' : language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : 'en-US';
  return date.toLocaleDateString(locale);
};

const getRelativeDayMeta = (value: string | null, language: AppLanguage) => {
  const copy = MY_POSTS_I18N[language as keyof typeof MY_POSTS_I18N] || MY_POSTS_I18N.en;
  if (!value) {
    return {
      label: copy.recently,
      dayDiff: Number.POSITIVE_INFINITY,
      isFresh: false,
      sortStamp: 0,
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      label: copy.recently,
      dayDiff: Number.POSITIVE_INFINITY,
      isFresh: false,
      sortStamp: 0,
    };
  }

  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startNow - startThen) / (24 * 60 * 60 * 1000));

  return {
    label: formatRelativeDay(value, language),
    dayDiff,
    isFresh: dayDiff <= 0,
    sortStamp: startThen,
  };
};

const formatPostCount = (value: number, language: AppLanguage) =>
  new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language] || 'en-US').format(value);

const groupPostsByDay = (posts: BlogPost[], language: AppLanguage) => {
  const groups = new Map<string, { label: string; sortStamp: number; posts: Array<BlogPost & { isFresh: boolean }> }>();

  for (const post of posts) {
    const meta = getRelativeDayMeta(post.createdAt, language);
    const key = `${meta.sortStamp}:${meta.label}`;
    const existing = groups.get(key);
    if (existing) {
      existing.posts.push({ ...post, isFresh: meta.isFresh });
      continue;
    }

    groups.set(key, {
      label: meta.label,
      sortStamp: meta.sortStamp,
      posts: [{ ...post, isFresh: meta.isFresh }],
    });
  }

  return Array.from(groups.values()).sort((a, b) => b.sortStamp - a.sortStamp);
};

function PostStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Heart;
  value: string;
  label: string;
}) {
  return (
    <span className={META_PILL_CLASS}>
      <Icon size={13} className="text-text-tertiary" />
      <span className="text-text-primary">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function PostMedia({ post }: { post: BlogPost }) {
  if (!post.mediaUrl) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <div className="relative aspect-[4/3] w-full bg-black">
        {post.mediaType === 'video' ? (
          <video
            src={post.mediaUrl}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={post.mediaUrl}
            alt={post.mediaAlt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}

interface MyPostsScreenProps {
  onBack: () => void;
}

export function MyPostsScreen({ onBack }: MyPostsScreenProps) {
  const userId = useMemo(() => resolveUserId(), []);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = MY_POSTS_I18N[language as keyof typeof MY_POSTS_I18N] || MY_POSTS_I18N.en;
  const isRtl = language === 'ar';
  const hydratedFromCacheRef = useRef(false);

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
  const groupedPosts = useMemo(() => groupPostsByDay(posts, language), [language, posts]);

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

    if (!hydratedFromCacheRef.current) {
      setLoading(true);
    }
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
    if (!userId) return;

    const cachedFeed = readOfflineCacheValue<any>(
      offlineCacheKeys.blogsFeed(userId, { limit: FEED_PAGE_LIMIT, authorId: userId }),
    );
    if (!cachedFeed) return;

    const loadedPosts = Array.isArray(cachedFeed?.posts)
      ? cachedFeed.posts.map((row: BlogPostApiRow) => mapPost(row)).filter((post: BlogPost) => post.id > 0 && post.userId === userId)
      : [];
    const cursor = parseCursor(cachedFeed?.nextCursor);
    if (!loadedPosts.length) return;

    hydratedFromCacheRef.current = true;
    setPosts(loadedPosts);
    setNextCursor(cursor);
    setHasMore(Boolean(cachedFeed?.hasMore) && Boolean(cursor));
    setError('');
    setLoading(false);
  }, [userId]);

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
    <div dir={isRtl ? 'rtl' : 'ltr'} className="flex min-h-screen flex-1 flex-col bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="space-y-4 px-4 sm:px-6">
        {error && (
          <Card className="!p-4 rounded-2xl border border-red-400/25 bg-red-500/10 text-sm text-red-200">
            {error}
          </Card>
        )}

        {loading ? (
          <Card className={`!p-4 ${SURFACE_CARD_CLASS}`}>
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin text-accent" />
              <span>{copy.loadingPosts}</span>
            </div>
          </Card>
        ) : posts.length === 0 ? (
          <Card className={`!p-0 overflow-hidden ${SURFACE_CARD_CLASS}`}>
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                <Sparkles size={24} />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">{copy.title}</h2>
                <p className="mx-auto max-w-xs text-sm leading-6 text-text-secondary">{copy.noPostsYet}</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-5">
            {groupedPosts.map((group) => (
              <section key={`${group.sortStamp}-${group.label}`} className="space-y-3">
                <div className="flex items-center gap-3 px-1">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-tertiary">
                    {group.label}
                  </h2>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="space-y-3">
                  {group.posts.map((post) => (
                    <Card
                      key={post.id}
                      className={`group !p-0 overflow-hidden ${SURFACE_CARD_CLASS} transition-all duration-200 hover:border-accent/30 hover:bg-white/[0.045]`}
                    >
                      <div className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${post.isFresh ? 'border-accent/25 bg-accent/10 text-accent' : 'border-white/10 bg-white/[0.04] text-text-secondary'}`}>
                                {post.category}
                              </span>
                              {post.isFresh && <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_rgba(163,230,53,0.65)]" />}
                            </div>
                            {post.description.trim() && (
                              <p className="text-base font-medium leading-7 text-text-primary whitespace-pre-wrap">
                                {post.description.trim()}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-[11px] font-medium text-text-tertiary">
                            {formatRelativeDay(post.createdAt, language)}
                          </div>
                        </div>

                        <PostMedia post={post} />

                        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                          <PostStat icon={Heart} value={formatPostCount(post.likes, language)} label={copy.likes} />
                          <PostStat icon={MessageSquare} value={formatPostCount(post.comments, language)} label={copy.comments} />
                          <PostStat icon={Eye} value={formatPostCount(post.views, language)} label={copy.views} />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openEdit(post)}
                            className={`${ACTION_BUTTON_CLASS} border-white/10 bg-white/[0.04] text-text-primary hover:border-accent/30 hover:bg-white/[0.08]`}
                          >
                            <Pencil size={14} />
                            {copy.edit}
                          </button>
                          <button
                            type="button"
                            disabled={deletingPostId === post.id}
                            onClick={() => { void deletePost(post.id); }}
                            className={`${ACTION_BUTTON_CLASS} border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/18`}
                          >
                            {deletingPostId === post.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            {deletingPostId === post.id ? copy.deleting : copy.delete}
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && posts.length > 0 && hasMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => { void loadMore(); }}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-medium text-text-primary transition-all duration-200 hover:border-accent/25 hover:bg-white/[0.08] active:scale-[0.99] disabled:opacity-60"
          >
            {loadingMore ? copy.loadingMore : copy.loadMore}
          </button>
        )}
      </div>

      {editingPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeEdit}
        >
          <div
            className={`w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-card p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${isRtl ? 'text-right' : 'text-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight text-white">{copy.editPost}</h3>
              <div className="text-xs text-text-tertiary">{formatRelativeDay(editingPost.createdAt, language)}</div>
            </div>

            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
              rows={5}
              placeholder={copy.updateDescription}
              className="min-h-[132px] w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm leading-6 text-white placeholder:text-text-secondary focus:border-accent/60 focus:outline-none"
            />
            <div className={`text-[11px] text-text-secondary ${isRtl ? 'text-left' : 'text-right'}`}>
              {editDescription.length}/{DESCRIPTION_MAX_LENGTH}
            </div>

            <ModernSelect
              value={editCategory}
              onChange={(nextValue) => setEditCategory(nextValue as PostCategory)}
              options={CATEGORY_OPTIONS.map((category) => ({ value: category, label: category }))}
            />

            {editError && (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">{editError}</div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/[0.08] disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => { void saveEdit(); }}
                disabled={savingEdit || !editDescription.trim()}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
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
