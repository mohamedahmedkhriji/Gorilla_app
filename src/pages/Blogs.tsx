import React, { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Copy, Facebook, Instagram, MessageCircleMore, Send, Upload, X } from 'lucide-react';
import { api } from '../services/api';
import { CoachmarkOverlay, type CoachmarkStep } from '../components/coachmarks/CoachmarkOverlay';
import FeedPage from '../components/feed/FeedPage';
import FeedHeader from '../components/feed/FeedHeader';
import CategoryFilters from '../components/feed/CategoryFilters';
import PostSkeleton from '../components/feed/PostSkeleton';
import { getStoredAppUser, getStoredUserId } from '../shared/authStorage';
import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../services/language';
import { offlineCacheKeys, readOfflineCacheValue } from '../services/offlineCache';
import { BLOGS_COACHMARK_TOUR_ID, BLOGS_COACHMARK_VERSION, getCoachmarkUserScope, patchCoachmarkProgress, readCoachmarkProgress } from '../services/coachmarks';
import { useScreenshotProtection } from '../shared/useScreenshotProtection';
import type { BlogComment, FeedCategory, FeedCursor, FeedTab, Post, PostCategory, ReactionOption, ReactionType, ShareDestination } from '../components/feed/types';

const FeedList = lazy(() => import('../components/feed/FeedList'));
const ReelsViewer = lazy(() => import('../components/feed/ReelsViewer'));

const CATEGORY_OPTIONS: PostCategory[] = ['Training', 'Nutrition', 'Recovery', 'Mindset'];
const TAB_OPTIONS: FeedTab[] = ['For You', 'Following', 'Latest'];
const INITIAL_PAGE_LIMIT = 5;
const FEED_PAGE_LIMIT = 5;
const DESCRIPTION_MAX_LENGTH = 5000;
const MEDIA_PAYLOAD_LIMIT = 8000000;
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=120&q=80';

interface BlogsProps {
  guidedTourActive?: boolean;
  onGuidedTourComplete?: () => void;
  onGuidedTourDismiss?: () => void;
}

const REACTION_ASSETS: Record<ReactionType, string> = {
  love: new URL('../../assets/reaction/love it.png', import.meta.url).href,
  fire: new URL('../../assets/reaction/fire.png', import.meta.url).href,
  power: new URL('../../assets/reaction/power.png', import.meta.url).href,
  wow: new URL('../../assets/reaction/wow.png', import.meta.url).href,
};

const enCopy = {
  feedTitle: 'Feed',
  feedSubtitle: 'Discover training, nutrition and recovery content',
  tabs: { 'For You': 'For You', Following: 'Following', Latest: 'Latest' } as Record<FeedTab, string>,
  refreshFeedAria: 'Refresh feed',
  createPostAria: 'Create new post',
  categories: { All: 'All', Women: 'Women', Training: 'Training', Nutrition: 'Nutrition', Recovery: 'Recovery', Mindset: 'Mindset' } as Record<FeedCategory, string>,
  noPosts: 'No posts yet. Tap + to add your first post.',
  noCategoryPosts: (categoryLabel: string) => `No ${categoryLabel.toLowerCase()} posts in this feed yet.`,
  showAllCategories: 'Show all',
  loading: 'Loading...',
  loadingMorePosts: 'Loading more posts...',
  caughtUp: 'You are all caught up.',
  womenOnly: 'Women only',
  postOptions: 'Post options',
  deletePost: 'Delete post',
  hidePost: 'Hide post',
  deleteTitle: 'Delete Post',
  deleteMessage: 'Are you sure you want to delete this post? This action cannot be undone.',
  deleteCancel: 'Cancel',
  deleteConfirmButton: 'Delete',
  reactToPost: 'React to post',
  reactions: { love: 'Love it', fire: 'Fire', power: 'Power', wow: 'Wow' } as Record<ReactionType, string>,
  shareTitle: 'Share Post',
  closeShare: 'Close share modal',
  shareEmpty: 'Choose where you want to share this post.',
  copyLink: 'Copy Link',
  closeFullScreen: 'Close full screen posts',
  newPostTitle: 'New Post',
  newPostPlaceholder: 'Share your update...',
  womenOnlyLabel: 'Post for women only',
  womenOnlyHint: 'Only women will see this post in the feed.',
  uploadMedia: 'Upload image',
  newPostPreviewAlt: 'New post preview',
  publishing: 'Publishing...',
  publish: 'Publish Post',
  commentsTitle: 'Comments',
  existingComments: (count: number) => `Existing comments: ${count}`,
  loadingComments: 'Loading comments...',
  noComments: 'No comments yet. Add one below.',
  addCommentPlaceholder: 'Add a comment...',
  postComment: 'Post Comment',
  postedRecently: 'Posted recently',
  postedRecentlyShort: 'recently',
  postedJustNow: 'Posted just now',
  postedJustNowShort: 'just now',
  postedMinutes: (value: number) => `Posted ${value}m ago`,
  postedMinutesShort: (value: number) => `${value}m ago`,
  postedHours: (value: number) => `Posted ${value}h ago`,
  postedHoursShort: (value: number) => `${value}h ago`,
  postedDays: (value: number) => `Posted ${value}d ago`,
  postedDaysShort: (value: number) => `${value}d ago`,
  shareDefaultDescription: 'Check out this post on RepSet.',
  shareCopiedFeedback: 'Link copied.',
  shareCopiedInstagramFeedback: 'Link copied. Paste it into Instagram DM.',
  shareCopyFailedFeedback: 'Could not copy link automatically.',
  errorDeletePost: 'Failed to delete post',
  errorMissingUser: 'Missing logged-in user id. Please login again.',
  errorLoadFeed: 'Failed to load feed',
  errorLoadMore: 'Failed to load more posts',
  errorUpdateLike: 'Failed to update reaction',
  errorLoadComments: 'Failed to load comments',
  errorPostComment: 'Failed to post comment',
  errorReadFile: 'Failed to read uploaded file.',
  errorFileTooLarge: 'Media file is too large.',
  errorDescriptionRequired: 'Write a short post description.',
  errorDescriptionTooLong: (max: number) => `Description is too long (max ${max} characters).`,
  errorMediaRequired: 'Upload an image.',
  errorPublish: 'Failed to publish post',
  errorCopyLink: 'Copy to clipboard failed',
  commentRequired: 'Write a comment before posting.',
  mediaAlt: 'Post media',
  mediaAltUserUpload: 'User uploaded media',
  fallbackUser: 'User',
  avatarAlt: (name: string) => `${name} avatar`,
  uploadTitle: 'Creating Post',
  uploadMessage: 'Please wait a moment...',
  maxTwoCategories: 'Choose up to 2 categories',
  save: 'Save post',
  saved: 'Saved',
  share: 'Share',
  reply: 'Reply',
  replyLabel: 'Replying to',
  views: 'views',
} as const;

type BlogCopy = typeof enCopy;

const BLOGS_I18N: Record<AppLanguage, BlogCopy> = {
  en: enCopy,
  ar: { ...enCopy, feedTitle: 'الخلاصة', feedSubtitle: 'اكتشف محتوى التدريب والتغذية والاستشفاء', tabs: { 'For You': 'لك', Following: 'المتابَعون', Latest: 'الأحدث' } },
  it: { ...enCopy, feedSubtitle: 'Scopri contenuti su allenamento, nutrizione e recupero', tabs: { 'For You': 'Per te', Following: 'Seguiti', Latest: 'Ultimi' } },
  fr: { ...enCopy, feedSubtitle: 'Decouvre du contenu sur l entrainement, la nutrition et la recuperation', tabs: { 'For You': 'Pour toi', Following: 'Abonnements', Latest: 'Recents' } },
  de: { ...enCopy, feedSubtitle: 'Entdecke Inhalte zu Training, Ernaehrung und Regeneration', tabs: { 'For You': 'Fuer dich', Following: 'Gefolgt', Latest: 'Neueste' } },
};

const BLOGS_COPY_OVERRIDES: Partial<Record<AppLanguage, Partial<BlogCopy>>> = {
  ar: {
    feedTitle: 'الخلاصة',
    feedSubtitle: 'اكتشف محتوى التدريب والتغذية والاستشفاء',
    tabs: { 'For You': 'لك', Following: 'المتابَعون', Latest: 'الأحدث' },
    refreshFeedAria: 'تحديث الخلاصة',
    createPostAria: 'إنشاء منشور جديد',
    categories: { All: 'الكل', Women: 'نساء', Training: 'تدريب', Nutrition: 'تغذية', Recovery: 'استشفاء', Mindset: 'عقلية' },
    noPosts: 'لا توجد منشورات بعد. اضغط + لإضافة أول منشور.',
    noCategoryPosts: (categoryLabel: string) => `لا توجد منشورات ${categoryLabel} في هذه الخلاصة حتى الآن.`,
    showAllCategories: 'عرض الكل',
    womenOnly: 'للنساء فقط',
    newPostTitle: 'منشور جديد',
    newPostPlaceholder: 'شارك تحديثك...',
    uploadMedia: 'رفع صورة',
    publish: 'نشر المنشور',
    commentsTitle: 'التعليقات',
    noComments: 'لا توجد تعليقات بعد. أضف تعليقًا بالأسفل.',
    addCommentPlaceholder: 'أضف تعليقًا...',
    errorLoadFeed: 'تعذر تحميل الخلاصة',
    errorLoadMore: 'تعذر تحميل المزيد من المنشورات',
    errorLoadComments: 'تعذر تحميل التعليقات',
    errorPublish: 'تعذر نشر المنشور',
    maxTwoCategories: 'اختر فئتين كحد أقصى',
    reply: 'رد',
    replyLabel: 'الرد على',
  },
  it: {
    refreshFeedAria: 'Aggiorna feed',
    createPostAria: 'Crea un nuovo post',
    categories: { All: 'Tutti', Women: 'Donne', Training: 'Allenamento', Nutrition: 'Nutrizione', Recovery: 'Recupero', Mindset: 'Mentalita' },
    noPosts: 'Nessun post ancora. Tocca + per aggiungere il primo post.',
    noCategoryPosts: (categoryLabel: string) => `Ancora nessun post ${categoryLabel.toLowerCase()} in questo feed.`,
    showAllCategories: 'Mostra tutto',
    womenOnly: 'Solo donne',
    newPostTitle: 'Nuovo post',
    newPostPlaceholder: 'Condividi il tuo aggiornamento...',
    uploadMedia: 'Carica immagine',
    publish: 'Pubblica post',
    commentsTitle: 'Commenti',
    errorLoadFeed: 'Impossibile caricare il feed',
    errorLoadMore: 'Impossibile caricare altri post',
    maxTwoCategories: 'Scegli fino a 2 categorie',
    reply: 'Rispondi',
    replyLabel: 'Risposta a',
  },
  fr: {
    feedTitle: 'Fil',
    refreshFeedAria: 'Actualiser le fil',
    createPostAria: 'Creer une nouvelle publication',
    categories: { All: 'Tout', Women: 'Femmes', Training: 'Entrainement', Nutrition: 'Nutrition', Recovery: 'Recuperation', Mindset: 'Mental' },
    noPosts: 'Aucune publication pour le moment. Appuie sur + pour ajouter la premiere.',
    noCategoryPosts: (categoryLabel: string) => `Aucune publication ${categoryLabel.toLowerCase()} dans ce fil pour le moment.`,
    showAllCategories: 'Tout afficher',
    womenOnly: 'Femmes uniquement',
    newPostTitle: 'Nouvelle publication',
    newPostPlaceholder: 'Partage ta mise a jour...',
    uploadMedia: 'Televerser une image',
    publish: 'Publier',
    commentsTitle: 'Commentaires',
    errorLoadFeed: 'Impossible de charger le fil',
    errorLoadMore: 'Impossible de charger plus de publications',
    maxTwoCategories: 'Choisis jusqu a 2 categories',
    reply: 'Repondre',
    replyLabel: 'Reponse a',
  },
  de: {
    refreshFeedAria: 'Feed aktualisieren',
    createPostAria: 'Neuen Beitrag erstellen',
    categories: { All: 'Alle', Women: 'Frauen', Training: 'Training', Nutrition: 'Ernaehrung', Recovery: 'Erholung', Mindset: 'Mindset' },
    noPosts: 'Noch keine Beitraege. Tippe auf +, um deinen ersten Beitrag zu erstellen.',
    noCategoryPosts: (categoryLabel: string) => `Noch keine ${categoryLabel.toLowerCase()}-Beitraege in diesem Feed.`,
    showAllCategories: 'Alle anzeigen',
    womenOnly: 'Nur fuer Frauen',
    newPostTitle: 'Neuer Beitrag',
    newPostPlaceholder: 'Teile dein Update...',
    uploadMedia: 'Bild hochladen',
    publish: 'Beitrag veroeffentlichen',
    commentsTitle: 'Kommentare',
    errorLoadFeed: 'Feed konnte nicht geladen werden',
    errorLoadMore: 'Weitere Beitraege konnten nicht geladen werden',
    maxTwoCategories: 'Waehle bis zu 2 Kategorien',
    reply: 'Antworten',
    replyLabel: 'Antwort an',
  },
};

const toCount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const formatCount = (value: number) => {
  const count = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (count < 1000) return new Intl.NumberFormat('en-US').format(Math.round(count));
  if (count >= 1000000000) return `${(count / 1000000000).toFixed(count >= 10000000000 ? 0 : 1).replace(/\.0$/, '')}B`;
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
  return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
};

const getPostedAgo = (createdAt: string | null, copy: BlogCopy, short = false) => {
  if (!createdAt) return short ? copy.postedRecentlyShort : copy.postedRecently;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return short ? copy.postedRecentlyShort : copy.postedRecently;
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return short ? copy.postedJustNowShort : copy.postedJustNow;
  if (diffMinutes < 60) return short ? copy.postedMinutesShort(diffMinutes) : copy.postedMinutes(diffMinutes);
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return short ? copy.postedHoursShort(diffHours) : copy.postedHours(diffHours);
  const diffDays = Math.floor(diffHours / 24);
  return short ? copy.postedDaysShort(diffDays) : copy.postedDays(diffDays);
};

const hasCoachmarkTargets = (steps: CoachmarkStep[]) =>
  typeof document !== 'undefined' && steps.every((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

const normalizeReactionType = (value: unknown): ReactionType | null => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'love' || normalized === 'fire' || normalized === 'power' || normalized === 'wow'
    ? normalized as ReactionType
    : null;
};

const isFemaleGender = (value: unknown) => ['female', 'woman', 'femme'].includes(String(value || '').trim().toLowerCase());

const buildOptimizedImageUrl = (value: string, width: number, quality = 72) => {
  const raw = String(value || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', String(quality));
      return url.toString();
    }
  } catch {
    return raw;
  }
  return raw;
};

const mapPost = (raw: Record<string, unknown>): Post => {
  const mediaType = raw.mediaType === 'video' ? 'video' : 'image';
  const mediaFull = String(raw.mediaUrl || '').trim();
  const reactions = (raw.metrics as Record<string, unknown> | undefined)?.reactions as Record<string, unknown> | undefined;
  return {
    id: Number(raw.id || 0),
    userId: Number(raw.userId || 0),
    authorName: String(raw.authorName || ''),
    authorGender: String(raw.authorGender || ''),
    womenOnly: Boolean(raw.womenOnly),
    avatarUrl: String(raw.avatarUrl || ''),
    latestCommentAvatarUrl: String(raw.latestCommentAvatarUrl || ''),
    verified: Boolean(raw.verified),
    caption: String(raw.description || ''),
    description: String(raw.description || ''),
    category: CATEGORY_OPTIONS.includes(raw.category as PostCategory) ? (raw.category as PostCategory) : 'Recovery',
    mediaType,
    mediaThumbnail: mediaType === 'image' ? buildOptimizedImageUrl(mediaFull, 720, 70) || mediaFull : mediaFull,
    mediaFull,
    mediaUrl: mediaFull,
    mediaAlt: typeof raw.mediaAlt === 'string' && raw.mediaAlt.trim() ? String(raw.mediaAlt) : '',
    mediaAspectRatio: '4 / 5',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
    reactionByMe: normalizeReactionType(raw.reactionByMe),
    likedByMe: Boolean(raw.likedByMe) || normalizeReactionType(raw.reactionByMe) !== null,
    views: toCount((raw.metrics as Record<string, unknown> | undefined)?.views),
    likes: toCount((raw.metrics as Record<string, unknown> | undefined)?.reactionsTotal) || toCount((raw.metrics as Record<string, unknown> | undefined)?.likes),
    reactions: { love: toCount(reactions?.love), fire: toCount(reactions?.fire), power: toCount(reactions?.power), wow: toCount(reactions?.wow) },
    comments: toCount((raw.metrics as Record<string, unknown> | undefined)?.comments),
  };
};

const mapComment = (raw: Record<string, unknown>): BlogComment => ({
  id: Number(raw.id || 0),
  postId: Number(raw.postId || 0),
  userId: Number(raw.userId || 0),
  authorName: String(raw.authorName || 'User'),
  avatarUrl: String(raw.avatarUrl || ''),
  text: String(raw.text || ''),
  createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
});

const parseFeedCursor = (value: unknown): FeedCursor | null => {
  if (!value || typeof value !== 'object') return null;
  const cursor = value as Record<string, unknown>;
  const cursorCreatedAt = String(cursor.cursorCreatedAt || '').trim();
  const cursorId = Number(cursor.cursorId || 0);
  return cursorCreatedAt && Number.isInteger(cursorId) && cursorId > 0 ? { cursorCreatedAt, cursorId } : null;
};

const mergePostsById = (current: Post[], incoming: Post[]) => {
  const map = new Map<number, Post>();
  current.forEach((post) => map.set(post.id, post));
  incoming.forEach((post) => map.set(post.id, post));
  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA || b.id - a.id;
  });
};

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

const readNumberSet = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0) : []);
  } catch {
    return new Set<number>();
  }
};

const writeNumberSet = (key: string, value: Set<number>) => localStorage.setItem(key, JSON.stringify(Array.from(value)));
const getUserProfileImage = () => String(getStoredAppUser()?.profile_picture || getStoredAppUser()?.profile_photo || '').trim();
const getUserGender = () => String(getStoredAppUser()?.gender || '').trim().toLowerCase();
const SENSITIVE_SERVER_ERROR_PATTERN = /(unknown column|field list|sql|database|syntax|sqlite|mysql|postgres|column)/i;
const toUserFacingError = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) return fallback;
  const message = String(error.message || '').trim();
  if (!message || SENSITIVE_SERVER_ERROR_PATTERN.test(message)) return fallback;
  return message;
};

export function Blogs({ guidedTourActive = false, onGuidedTourComplete, onGuidedTourDismiss }: BlogsProps) {
  useScreenshotProtection();

  const userId = useMemo(() => getStoredUserId(), []);
  const userProfileImage = useMemo(() => getUserProfileImage(), []);
  const coachmarkScope = useMemo(() => getCoachmarkUserScope(getStoredAppUser()), []);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = useMemo(
    () => ({ ...pickLanguage(language, BLOGS_I18N), ...(BLOGS_COPY_OVERRIDES[language] || {}) }),
    [language],
  );
  const isArabic = language === 'ar';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('For You');
  const [activeCategory, setActiveCategory] = useState<FeedCategory>('All');
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [openPostMenuId, setOpenPostMenuId] = useState<number | null>(null);
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<number | null>(null);
  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, BlogComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [replyToComment, setReplyToComment] = useState<{ id: number; name: string } | null>(null);
  const [activeSharePostId, setActiveSharePostId] = useState<number | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<PostCategory[]>(['Recovery']);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [newWomenOnly, setNewWomenOnly] = useState(false);
  const [createError, setCreateError] = useState('');
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);
  const [isCoachmarkOpen, setIsCoachmarkOpen] = useState(false);
  const [userGender, setUserGender] = useState(() => getUserGender());
  const [savedPostIds, setSavedPostIds] = useState<Set<number>>(new Set());
  const [engagedAuthorIds, setEngagedAuthorIds] = useState<Set<number>>(new Set());
  const deferredCategory = useDeferredValue(activeCategory);
  const deferredTab = useDeferredValue(activeTab);
  const [, startTransition] = useTransition();
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const viewedPostIdsRef = useRef<Set<number>>(new Set());
  const hydratedFromCacheRef = useRef(false);
  const showWomenFilter = isFemaleGender(userGender);
  const hiddenPostStorageKey = useMemo(() => `blogs:hidden:${userId || 'guest'}`, [userId]);
  const savedPostStorageKey = useMemo(() => `blogs:saved:${userId || 'guest'}`, [userId]);
  const engagedAuthorStorageKey = useMemo(() => `blogs:engaged-authors:${userId || 'guest'}`, [userId]);
  const primaryCategory = selectedCategories[0] || 'Recovery';
  const canCreateWomenOnlyPost = showWomenFilter;

  useEffect(() => {
    setLanguage(getActiveLanguage());
    const handleLanguageChanged = () => setLanguage(getStoredLanguage());
    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    setSavedPostIds(readNumberSet(savedPostStorageKey));
    setEngagedAuthorIds(readNumberSet(engagedAuthorStorageKey));
  }, [engagedAuthorStorageKey, savedPostStorageKey]);

  const readHiddenPostIds = useCallback(() => readNumberSet(hiddenPostStorageKey), [hiddenPostStorageKey]);
  const getCategoryLabel = useCallback((category: FeedCategory) => copy.categories[category] || String(category), [copy.categories]);
  const getAuthorName = useCallback((name: string) => name || copy.fallbackUser, [copy.fallbackUser]);

  const markAuthorEngaged = useCallback((authorId: number) => {
    if (!authorId) return;
    setEngagedAuthorIds((prev) => {
      if (prev.has(authorId)) return prev;
      const next = new Set(prev);
      next.add(authorId);
      writeNumberSet(engagedAuthorStorageKey, next);
      return next;
    });
  }, [engagedAuthorStorageKey]);

  const toggleSavedPost = useCallback((postId: number) => {
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      writeNumberSet(savedPostStorageKey, next);
      return next;
    });
    const post = posts.find((item) => item.id === postId);
    if (post) markAuthorEngaged(post.userId);
  }, [markAuthorEngaged, posts, savedPostStorageKey]);

  const reactionOptions = useMemo<ReactionOption[]>(
    () => [
      { type: 'love', label: copy.reactions.love, image: REACTION_ASSETS.love },
      { type: 'fire', label: copy.reactions.fire, image: REACTION_ASSETS.fire },
      { type: 'power', label: copy.reactions.power, image: REACTION_ASSETS.power },
      { type: 'wow', label: copy.reactions.wow, image: REACTION_ASSETS.wow },
    ],
    [copy.reactions.fire, copy.reactions.love, copy.reactions.power, copy.reactions.wow],
  );

  const categoryFilters = useMemo<FeedCategory[]>(
    () => (showWomenFilter ? ['All', 'Women', ...CATEGORY_OPTIONS] : ['All', ...CATEGORY_OPTIONS]),
    [showWomenFilter],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<FeedCategory, number> = { All: posts.length, Women: 0, Training: 0, Nutrition: 0, Recovery: 0, Mindset: 0 };
    posts.forEach((post) => {
      if (isFemaleGender(post.authorGender)) counts.Women += 1;
      counts[post.category] += 1;
    });
    return counts;
  }, [posts]);

  const visiblePosts = useMemo(() => {
    let next = deferredCategory === 'All' ? posts : deferredCategory === 'Women'
      ? posts.filter((post) => isFemaleGender(post.authorGender))
      : posts.filter((post) => post.category === deferredCategory);

    if (deferredTab === 'Latest') {
      next = [...next].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime() || b.id - a.id);
    }
    if (deferredTab === 'Following') {
      const followed = next.filter((post) => post.userId === userId || engagedAuthorIds.has(post.userId));
      return followed.length ? followed : next;
    }
    return next;
  }, [deferredCategory, deferredTab, engagedAuthorIds, posts, userId]);

  const resolvePostAvatar = useCallback((post: Post) => (post.userId === userId && userProfileImage) || post.avatarUrl || DEFAULT_AVATAR, [userId, userProfileImage]);
  const resolveCommentAvatar = useCallback((comment: BlogComment) => (comment.userId === userId && userProfileImage) || comment.avatarUrl || DEFAULT_AVATAR, [userId, userProfileImage]);
  const getLatestCommentAvatarUrl = useCallback((comments: BlogComment[]) => {
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const avatar = String(resolveCommentAvatar(comments[index]) || '').trim();
      if (avatar && avatar !== DEFAULT_AVATAR) return avatar;
    }
    return '';
  }, [resolveCommentAvatar]);

  const coachmarkOptions = useMemo(() => ({
    tourId: BLOGS_COACHMARK_TOUR_ID,
    version: BLOGS_COACHMARK_VERSION,
    userScope: coachmarkScope,
    defaultSeenSteps: { create: false, intro: false, filters: false, first_post: false },
  }), [coachmarkScope]);

  const coachmarkCopy = useMemo(() => ({
    next: isArabic ? 'التالي' : 'Next',
    skip: isArabic ? 'تخطي' : 'Skip',
    finish: isArabic ? 'حسنًا' : 'Got it',
    steps: [
      { id: 'create', targetId: 'blogs_create_button', title: isArabic ? 'أنشئ منشورًا جديدًا' : 'Create a new post', body: isArabic ? 'استخدم هذا الزر لإنشاء منشور جديد في الخلاصة.' : 'Use this button to create a new post.', placement: 'bottom' as const, shape: 'circle' as const, padding: 8 },
      { id: 'intro', targetId: 'blogs_page_intro', title: isArabic ? 'هذه هي صفحة الخلاصة' : 'This is the feed', body: isArabic ? 'هنا ترى محتوى المجتمع عن التدريب والتغذية والاستشفاء.' : 'This page shows the community feed for training, nutrition and recovery.', placement: 'bottom' as const, shape: 'rounded' as const, padding: 8, cornerRadius: 16 },
      { id: 'filters', targetId: 'blogs_category_filters', title: isArabic ? 'غيّر الفئة من هنا' : 'Filter the feed here', body: isArabic ? 'استخدم هذه الفلاتر لتبديل الفئة التي تريدها.' : 'Use these filters to focus the feed on a specific content category.', placement: 'bottom' as const, shape: 'rounded' as const, padding: 8, cornerRadius: 16 },
      { id: 'first_post', targetId: 'blogs_first_post_card', title: isArabic ? 'هذا مثال على منشور' : 'This is a feed post', body: isArabic ? 'اضغط على أي منشور لفتحه والتفاعل معه وقراءة التعليقات.' : 'Tap any post to open it, react, and read comments.', placement: 'top' as const, shape: 'rounded' as const, padding: 8, cornerRadius: 20 },
    ] satisfies CoachmarkStep[],
  }), [isArabic]);

  const coachmarkSteps = coachmarkCopy.steps;
  const activeCoachmarkStep = coachmarkSteps[coachmarkStepIndex] || null;

  useEffect(() => {
    const loadViewerGender = async () => {
      if (!userId || userGender) return;
      try {
        const profile = await api.getProfileDetails(userId);
        setUserGender(String(profile?.gender || '').trim().toLowerCase());
      } catch {
        // Keep feed usable if profile details fail.
      }
    };
    void loadViewerGender();
  }, [userGender, userId]);

  useEffect(() => {
    if (!showWomenFilter && activeCategory === 'Women') setActiveCategory('All');
  }, [activeCategory, showWomenFilter]);

  const removePostFromView = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setCommentsByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setOpenPostMenuId((prev) => (prev === postId ? null : prev));
    setOpenReactionPostId((prev) => (prev === postId ? null : prev));
    setActiveSharePostId((prev) => (prev === postId ? null : prev));
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      setCommentError('');
      setReplyToComment(null);
    }
    if (activeReelIndex != null) setActiveReelIndex(null);
  }, [activeCommentsPostId, activeReelIndex]);

  const hidePost = useCallback((postId: number) => {
    const hidden = readHiddenPostIds();
    hidden.add(postId);
    writeNumberSet(hiddenPostStorageKey, hidden);
    removePostFromView(postId);
  }, [hiddenPostStorageKey, readHiddenPostIds, removePostFromView]);

  const deleteOwnPost = useCallback(async (postId: number) => {
    if (!userId) return;
    try {
      await api.deleteBlogPost(postId, userId);
      removePostFromView(postId);
    } catch (err) {
      setError(toUserFacingError(err, copy.errorDeletePost));
    }
  }, [copy.errorDeletePost, removePostFromView, userId]);

  const confirmDeletePost = useCallback(async () => {
    if (!pendingDeletePostId) return;
    const postId = pendingDeletePostId;
    setPendingDeletePostId(null);
    await deleteOwnPost(postId);
  }, [deleteOwnPost, pendingDeletePostId]);

  const loadFeedChunk = useCallback(async (cursor: FeedCursor | null, limit: number) => {
    if (!userId) throw new Error(copy.errorMissingUser);
    const response = await api.getBlogsFeed(userId, { limit, cursorCreatedAt: cursor?.cursorCreatedAt, cursorId: cursor?.cursorId });
    const hiddenIds = readHiddenPostIds();
    const nextPosts = Array.isArray(response?.posts) ? response.posts.map(mapPost).filter((post) => !hiddenIds.has(post.id)) : [];
    const parsedCursor = parseFeedCursor(response?.nextCursor);
    return { posts: nextPosts, cursor: parsedCursor, hasMore: Boolean(response?.hasMore) && Boolean(parsedCursor) };
  }, [copy.errorMissingUser, readHiddenPostIds, userId]);

  const loadInitialFeed = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!userId) {
      setError(copy.errorMissingUser);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (mode === 'initial' && !hydratedFromCacheRef.current) setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError('');
    try {
      viewedPostIdsRef.current.clear();
      const response = await loadFeedChunk(null, INITIAL_PAGE_LIMIT);
      setPosts(response.posts);
      setNextCursor(response.cursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(toUserFacingError(err, copy.errorLoadFeed));
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, [copy.errorLoadFeed, copy.errorMissingUser, loadFeedChunk, userId]);

  const loadMoreFeed = useCallback(async () => {
    if (!userId || !hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const response = await loadFeedChunk(nextCursor, FEED_PAGE_LIMIT);
      setPosts((prev) => mergePostsById(prev, response.posts));
      setNextCursor(response.cursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(toUserFacingError(err, copy.errorLoadMore));
    } finally {
      setLoadingMore(false);
    }
  }, [copy.errorLoadMore, hasMore, loadFeedChunk, loadingMore, nextCursor, userId]);

  useEffect(() => {
    if (!userId) return;
    const cachedFeed = readOfflineCacheValue<any>(offlineCacheKeys.blogsFeed(userId, { limit: INITIAL_PAGE_LIMIT }));
    if (!cachedFeed) return;
    const hiddenIds = readHiddenPostIds();
    const nextPosts = Array.isArray(cachedFeed?.posts) ? cachedFeed.posts.map(mapPost).filter((post: Post) => !hiddenIds.has(post.id)) : [];
    const parsedCursor = parseFeedCursor(cachedFeed?.nextCursor);
    if (nextPosts.length) {
      hydratedFromCacheRef.current = true;
      setPosts(nextPosts);
      setNextCursor(parsedCursor);
      setHasMore(Boolean(cachedFeed?.hasMore) && Boolean(parsedCursor));
      setError('');
      setLoading(false);
    }
  }, [readHiddenPostIds, userId]);

  useEffect(() => { void loadInitialFeed('initial'); }, [loadInitialFeed]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-post-menu-root="true"]') || target?.closest('[data-reaction-menu-root="true"]')) return;
      setOpenPostMenuId(null);
      setOpenReactionPostId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const trackView = useCallback(async (postId: number) => {
    if (!userId || viewedPostIdsRef.current.has(postId)) return;
    viewedPostIdsRef.current.add(postId);
    try {
      const response = await api.trackBlogView(postId, userId);
      const viewsCount = toCount(response?.viewsCount);
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, views: viewsCount } : post)));
    } catch {
      viewedPostIdsRef.current.delete(postId);
    }
  }, [userId]);

  const openReelAt = useCallback((index: number) => {
    if (!visiblePosts.length) return;
    const bounded = Math.max(0, Math.min(visiblePosts.length - 1, index));
    setActiveReelIndex(bounded);
    const post = visiblePosts[bounded];
    if (post) void trackView(post.id);
  }, [trackView, visiblePosts]);

  const setReaction = useCallback(async (postId: number, reactionType: ReactionType | null) => {
    if (!userId) return;
    try {
      const response = await api.setBlogReaction(postId, { userId, reactionType });
      const nextReaction = normalizeReactionType(response?.reactionType);
      const reactions = response?.reactions as Record<string, unknown> | undefined;
      const reactionsTotal = toCount(response?.reactionsTotal ?? response?.likesCount);
      setPosts((prev) => prev.map((post) => (
        post.id === postId
          ? { ...post, reactionByMe: nextReaction, likedByMe: Boolean(nextReaction), likes: reactionsTotal, reactions: { love: toCount(reactions?.love), fire: toCount(reactions?.fire), power: toCount(reactions?.power), wow: toCount(reactions?.wow) } }
          : post
      )));
      const post = posts.find((item) => item.id === postId);
      if (post) markAuthorEngaged(post.userId);
    } catch (err) {
      setError(toUserFacingError(err, copy.errorUpdateLike));
    }
  }, [copy.errorUpdateLike, markAuthorEngaged, posts, userId]);

  const handleDoubleLike = useCallback((postId: number) => {
    const post = posts.find((item) => item.id === postId);
    if (!post || post.reactionByMe) return;
    void setReaction(postId, 'love');
  }, [posts, setReaction]);

  const loadComments = useCallback(async (postId: number) => {
    setCommentsLoading(true);
    setCommentError('');
    try {
      const response = await api.getBlogComments(postId, 200);
      const comments = Array.isArray(response?.comments) ? response.comments.map(mapComment) : [];
      const latestCommentAvatarUrl = getLatestCommentAvatarUrl(comments);
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, comments: comments.length, latestCommentAvatarUrl } : post)));
    } catch (err) {
      setCommentError(toUserFacingError(err, copy.errorLoadComments));
    } finally {
      setCommentsLoading(false);
    }
  }, [copy.errorLoadComments, getLatestCommentAvatarUrl]);

  const openComments = useCallback((postId: number) => {
    setActiveCommentsPostId(postId);
    setNewCommentText('');
    setCommentError('');
    setReplyToComment(null);
    setOpenReactionPostId(null);
    void loadComments(postId);
  }, [loadComments]);

  const getSharePayload = useCallback((post: Post) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/blogs?post=${post.id}`;
    const cleanedDescription = post.caption.replace(/\s+/g, ' ').trim();
    const summary = cleanedDescription ? `${cleanedDescription.slice(0, 120).trim()}${cleanedDescription.length > 120 ? '...' : ''}` : copy.shareDefaultDescription;
    return { shareUrl, shareText: `${getAuthorName(post.authorName)}: ${summary}` };
  }, [copy.shareDefaultDescription, getAuthorName]);

  const copyToClipboard = useCallback(async (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (!copied) throw new Error(copy.errorCopyLink);
  }, [copy.errorCopyLink]);

  const openShareModal = useCallback((postId: number) => {
    setActiveSharePostId(postId);
    setShareFeedback('');
  }, []);

  const closeShareModal = useCallback(() => {
    setActiveSharePostId(null);
    setShareFeedback('');
  }, []);

  const sharePostTo = useCallback(async (destination: ShareDestination) => {
    const post = activeSharePostId ? posts.find((item) => item.id === activeSharePostId) : null;
    if (!post) return;
    const { shareUrl, shareText } = getSharePayload(post);
    const shareMessage = `${shareText} ${shareUrl}`.trim();
    const openUrl = (url: string) => {
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) window.location.assign(url);
    };
    if (destination === 'whatsapp') {
      openUrl(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`);
      closeShareModal();
      return;
    }
    if (destination === 'facebook') {
      openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`);
      closeShareModal();
      return;
    }
    if (destination === 'messages') {
      window.location.href = `sms:?&body=${encodeURIComponent(shareMessage)}`;
      closeShareModal();
      return;
    }
    if (destination === 'instagram') openUrl('https://www.instagram.com/direct/inbox/');
    try {
      await copyToClipboard(shareMessage);
      setShareFeedback(destination === 'instagram' ? copy.shareCopiedInstagramFeedback : copy.shareCopiedFeedback);
    } catch {
      setShareFeedback(copy.shareCopyFailedFeedback);
    }
  }, [activeSharePostId, closeShareModal, copy.shareCopiedFeedback, copy.shareCopiedInstagramFeedback, copy.shareCopyFailedFeedback, copyToClipboard, getSharePayload, posts]);

  const addComment = useCallback(async () => {
    if (!activeCommentsPostId || !userId) return;
    const text = newCommentText.trim();
    const replyPrefix = replyToComment ? `@${replyToComment.name}` : '';
    if (!text || (replyPrefix && text === replyPrefix)) {
      setCommentError(copy.commentRequired);
      return;
    }
    try {
      const finalText = replyPrefix && !text.startsWith(replyPrefix) ? `${replyPrefix} ${text}` : text;
      const response = await api.addBlogComment(activeCommentsPostId, { userId, text: finalText });
      const comment = response?.comment ? mapComment(response.comment) : null;
      const commentsCount = toCount(response?.commentsCount);
      const nextComments = comment ? [...(commentsByPost[activeCommentsPostId] || []), comment] : commentsByPost[activeCommentsPostId] || [];
      const latestCommentAvatarUrl = getLatestCommentAvatarUrl(nextComments);
      if (comment) setCommentsByPost((prev) => ({ ...prev, [activeCommentsPostId]: nextComments }));
      setPosts((prev) => prev.map((post) => (post.id === activeCommentsPostId ? { ...post, comments: commentsCount, latestCommentAvatarUrl } : post)));
      const post = posts.find((item) => item.id === activeCommentsPostId);
      if (post) markAuthorEngaged(post.userId);
      setNewCommentText('');
      setReplyToComment(null);
      setCommentError('');
    } catch (err) {
      setCommentError(toUserFacingError(err, copy.errorPostComment));
    }
  }, [activeCommentsPostId, commentsByPost, copy.commentRequired, copy.errorPostComment, getLatestCommentAvatarUrl, markAuthorEngaged, newCommentText, posts, replyToComment, userId]);

  useEffect(() => {
    if (isCreateOpen || activeReelIndex != null || isCoachmarkOpen) return;
    const timer = window.setTimeout(() => {
      const progress = readCoachmarkProgress(coachmarkOptions);
      if (guidedTourActive && !progress.completed && !progress.dismissed && hasCoachmarkTargets(coachmarkSteps)) {
        setCoachmarkStepIndex(Math.min(progress.currentStep, coachmarkSteps.length - 1));
        setIsCoachmarkOpen(true);
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [activeReelIndex, coachmarkOptions, coachmarkSteps, guidedTourActive, isCoachmarkOpen, isCreateOpen]);

  const closeCoachmarks = useCallback(() => {
    setIsCoachmarkOpen(false);
    setCoachmarkStepIndex(0);
  }, []);

  const handleCoachmarkNext = useCallback(() => {
    if (!activeCoachmarkStep || coachmarkStepIndex >= coachmarkSteps.length - 1) return;
    patchCoachmarkProgress(coachmarkOptions, (current) => ({
      currentStep: coachmarkStepIndex + 1,
      seenSteps: { ...current.seenSteps, [activeCoachmarkStep.id]: true },
    }));
    setCoachmarkStepIndex((current) => Math.min(current + 1, coachmarkSteps.length - 1));
  }, [activeCoachmarkStep, coachmarkOptions, coachmarkStepIndex, coachmarkSteps.length]);

  const handleCoachmarkFinish = useCallback(() => {
    if (!activeCoachmarkStep) return;
    patchCoachmarkProgress(coachmarkOptions, (current) => ({
      completed: true,
      dismissed: false,
      currentStep: Math.max(coachmarkSteps.length - 1, 0),
      seenSteps: { ...current.seenSteps, [activeCoachmarkStep.id]: true },
    }));
    closeCoachmarks();
    if (guidedTourActive) onGuidedTourComplete?.();
  }, [activeCoachmarkStep, closeCoachmarks, coachmarkOptions, coachmarkSteps.length, guidedTourActive, onGuidedTourComplete]);

  const handleCoachmarkSkip = useCallback(() => {
    patchCoachmarkProgress(coachmarkOptions, { dismissed: true, currentStep: coachmarkStepIndex });
    closeCoachmarks();
    if (guidedTourActive) onGuidedTourDismiss?.();
  }, [closeCoachmarks, coachmarkOptions, coachmarkStepIndex, guidedTourActive, onGuidedTourDismiss]);

  const toggleCategorySelection = useCallback((category: PostCategory) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        const next = prev.filter((item) => item !== category);
        return next.length ? next : [category];
      }
      if (prev.length >= 2) return prev;
      return [...prev, category];
    });
  }, []);

  const handleFilePicked = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setCreateError(copy.errorMediaRequired);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (!dataUrl) return setCreateError(copy.errorReadFile);
      if (dataUrl.length > MEDIA_PAYLOAD_LIMIT) return setCreateError(copy.errorFileTooLarge);
      setNewMediaUrl(dataUrl);
      setNewMediaType('image');
      setCreateError('');
    } catch {
      setCreateError(copy.errorReadFile);
    }
  }, [copy.errorFileTooLarge, copy.errorMediaRequired, copy.errorReadFile]);

  const publishPost = useCallback(async () => {
    if (!userId) return setCreateError(copy.errorMissingUser);
    const description = newDescription.trim();
    if (!description) return setCreateError(copy.errorDescriptionRequired);
    if (description.length > DESCRIPTION_MAX_LENGTH) return setCreateError(copy.errorDescriptionTooLong(DESCRIPTION_MAX_LENGTH));
    if (!newMediaUrl) return setCreateError(copy.errorMediaRequired);
    setIsPublishing(true);
    setCreateError('');
    try {
      const response = await api.createBlogPost({ userId, description, category: primaryCategory, mediaType: newMediaType, mediaUrl: newMediaUrl, mediaAlt: copy.mediaAltUserUpload, womenOnly: canCreateWomenOnlyPost && newWomenOnly });
      const created = response?.post ? mapPost(response.post) : null;
      if (created) {
        setPosts((prev) => [created, ...prev.filter((post) => post.id !== created.id)]);
        setActiveTab('For You');
        setActiveCategory('All');
      } else {
        await loadInitialFeed('refresh');
      }
      setNewDescription('');
      setSelectedCategories(['Recovery']);
      setNewMediaType('image');
      setNewMediaUrl('');
      setNewWomenOnly(false);
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(toUserFacingError(err, copy.errorPublish));
    } finally {
      setIsPublishing(false);
    }
  }, [canCreateWomenOnlyPost, copy.errorDescriptionRequired, copy.errorDescriptionTooLong, copy.errorMediaRequired, copy.errorMissingUser, copy.errorPublish, copy.mediaAltUserUpload, loadInitialFeed, newDescription, newMediaType, newMediaUrl, newWomenOnly, primaryCategory, userId]);

  const activeCommentsPost = activeCommentsPostId ? posts.find((post) => post.id === activeCommentsPostId) || null : null;
  const activeSharePost = activeSharePostId ? posts.find((post) => post.id === activeSharePostId) || null : null;
  const localComments = activeCommentsPostId ? commentsByPost[activeCommentsPostId] || [] : [];
  const canPublish = Boolean(newDescription.trim()) && Boolean(newMediaUrl) && !isPublishing;
  const selectCategory = useCallback((category: FeedCategory) => startTransition(() => setActiveCategory(category)), []);
  const closeCreateModal = useCallback(() => {
    setIsCreateOpen(false);
    setCreateError('');
    setNewWomenOnly(false);
  }, []);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="blogs-page relative flex min-h-screen flex-1 flex-col pb-24">
      <FeedPage
        header={<FeedHeader onRefresh={() => { void loadInitialFeed('refresh'); }} onCreate={() => { setIsCreateOpen(true); setCreateError(''); }} refreshAria={copy.refreshFeedAria} createAria={copy.createPostAria} refreshing={refreshing} />}
        filters={<CategoryFilters filters={categoryFilters} activeCategory={activeCategory} onSelect={selectCategory} getLabel={getCategoryLabel} getCount={(category) => categoryCounts[category]} />}
        error={error}
      >
        {loading && !posts.length ? <div className="space-y-5">{Array.from({ length: 3 }).map((_, index) => <PostSkeleton key={index} />)}</div> : visiblePosts.length === 0 ? (
          <div data-coachmark-target="blogs_first_post_card" className="surface-glass rounded-[24px] border border-white/10 p-5 text-sm text-text-secondary">
            <div>{posts.length === 0 ? copy.noPosts : copy.noCategoryPosts(getCategoryLabel(activeCategory))}</div>
            {posts.length > 0 ? <button type="button" onClick={() => selectCategory('All')} className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-text-primary transition-all duration-200 hover:border-accent/20 hover:bg-white/10 active:scale-95">{copy.showAllCategories}</button> : null}
          </div>
        ) : (
          <Suspense fallback={<div className="space-y-5">{Array.from({ length: 2 }).map((_, index) => <PostSkeleton key={`fallback-${index}`} />)}</div>}>
            <FeedList
              posts={visiblePosts}
              currentUserId={userId}
              savedPostIds={savedPostIds}
              reactionOptions={reactionOptions}
              openMenuId={openPostMenuId}
              openReactionPostId={openReactionPostId}
              loadingMore={loadingMore}
              hasMore={hasMore}
              caughtUpLabel={copy.caughtUp}
              loadingMoreLabel={copy.loadingMorePosts}
              copy={{ avatarAlt: copy.avatarAlt, mediaAlt: copy.mediaAlt, womenOnly: copy.womenOnly, postOptions: copy.postOptions, deletePost: copy.deletePost, hidePost: copy.hidePost, reactToPost: copy.reactToPost, save: copy.save, saved: copy.saved, share: copy.share }}
              getAuthorName={getAuthorName}
              getPostedAgo={(createdAt, short = false) => getPostedAgo(createdAt, copy, short)}
              resolveAvatar={resolvePostAvatar}
              formatCount={formatCount}
              onLoadMore={() => { void loadMoreFeed(); }}
              onOpenPost={openReelAt}
              onDoubleLike={handleDoubleLike}
              onToggleMenu={(postId) => setOpenPostMenuId((current) => current === postId ? null : postId)}
              onToggleReactions={(postId) => setOpenReactionPostId((current) => current === postId ? null : postId)}
              onReact={(postId, reactionType) => { setOpenReactionPostId(null); void setReaction(postId, reactionType); }}
              onComments={openComments}
              onShare={openShareModal}
              onSave={toggleSavedPost}
              onDelete={(postId) => { setOpenPostMenuId(null); setPendingDeletePostId(postId); }}
              onHide={hidePost}
            />
          </Suspense>
        )}
      </FeedPage>

      {isPublishing ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[280px] rounded-[24px] border border-white/10 bg-card px-5 py-4 text-center text-text-primary shadow-2xl">
            <div className="text-base font-semibold">{copy.uploadTitle}</div>
            <div className="mt-1 text-sm text-text-secondary">{copy.uploadMessage}</div>
            <div className="mt-4 flex justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-text-tertiary border-t-transparent" />
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeletePostId != null ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4" onClick={() => setPendingDeletePostId(null)}>
          <div className={`w-full max-w-sm rounded-[24px] border border-white/10 bg-card p-5 shadow-2xl ${isArabic ? 'text-right' : 'text-left'}`} dir={isArabic ? 'rtl' : 'ltr'} onClick={(event) => event.stopPropagation()}>
            <div className={`flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-base font-semibold text-text-primary">{copy.deleteTitle}</h3>
              <button type="button" onClick={() => setPendingDeletePostId(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-text-primary"><X size={16} /></button>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{copy.deleteMessage}</p>
            <div className={`mt-5 flex gap-2 ${isArabic ? 'justify-start' : 'justify-end'}`}>
              <button type="button" onClick={() => setPendingDeletePostId(null)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-text-secondary transition-colors hover:border-accent/20 hover:text-text-primary">{copy.deleteCancel}</button>
              <button type="button" onClick={() => { void confirmDeletePost(); }} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-400">{copy.deleteConfirmButton}</button>
            </div>
          </div>
        </div>
      ) : null}

      {activeReelIndex != null ? (
        <Suspense fallback={<div className="fixed inset-0 z-[60] bg-black" />}>
          <ReelsViewer
            posts={visiblePosts}
            initialIndex={activeReelIndex}
            isSaved={(postId) => savedPostIds.has(postId)}
            onClose={() => setActiveReelIndex(null)}
            onReact={(postId, reactionType) => { void setReaction(postId, reactionType); }}
            onDoubleLike={handleDoubleLike}
            onComments={openComments}
            onShare={openShareModal}
            onSave={toggleSavedPost}
            onTrackView={(postId) => { void trackView(postId); }}
            reactionOptions={reactionOptions}
            resolveAvatar={resolvePostAvatar}
            getAuthorName={getAuthorName}
            getPostedAgo={(createdAt, short = false) => getPostedAgo(createdAt, copy, short)}
            formatCount={formatCount}
            copy={{ avatarAlt: copy.avatarAlt, closeFullScreen: copy.closeFullScreen, reactToPost: copy.reactToPost, mediaAlt: copy.mediaAlt }}
          />
        </Suspense>
      ) : null}

      {activeSharePost ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={closeShareModal}>
          <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">{copy.shareTitle}</h3>
              <button type="button" onClick={closeShareModal} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary" aria-label={copy.closeShare}><X size={16} /></button>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{activeSharePost.caption.trim() ? `${activeSharePost.caption.trim().slice(0, 90)}${activeSharePost.caption.trim().length > 90 ? '...' : ''}` : copy.shareEmpty}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { void sharePostTo('whatsapp'); }} className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-3 py-4 text-text-primary transition-all duration-200 hover:border-accent/20 hover:bg-white/10 active:scale-[0.98]"><MessageCircleMore size={20} className="text-[#25D366]" /><span className="text-xs font-medium">WhatsApp</span></button>
              <button type="button" onClick={() => { void sharePostTo('facebook'); }} className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-3 py-4 text-text-primary transition-all duration-200 hover:border-accent/20 hover:bg-white/10 active:scale-[0.98]"><Facebook size={20} className="text-[#1877F2]" /><span className="text-xs font-medium">Facebook</span></button>
              <button type="button" onClick={() => { void sharePostTo('instagram'); }} className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-3 py-4 text-text-primary transition-all duration-200 hover:border-accent/20 hover:bg-white/10 active:scale-[0.98]"><Instagram size={20} className="text-[#E1306C]" /><span className="text-xs font-medium">Instagram</span></button>
              <button type="button" onClick={() => { void sharePostTo('copy'); }} className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-3 py-4 text-text-primary transition-all duration-200 hover:border-accent/20 hover:bg-white/10 active:scale-[0.98]"><Copy size={20} className="text-text-primary" /><span className="text-xs font-medium">{copy.copyLink}</span></button>
            </div>
            {shareFeedback ? <p className="mt-3 text-xs text-accent">{shareFeedback}</p> : null}
          </div>
        </div>
      ) : null}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-4 pb-6 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:pt-8" onClick={closeCreateModal}>
          <div className={`w-full max-w-md rounded-[28px] border border-white/10 bg-card p-5 shadow-2xl ${isArabic ? 'text-right' : 'text-left'}`} dir={isArabic ? 'rtl' : 'ltr'} onClick={(event) => event.stopPropagation()}>
            <div className={`flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-electrolize text-xl text-text-primary">{copy.newPostTitle}</h3>
              <button type="button" onClick={closeCreateModal} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-text-primary"><X size={16} /></button>
            </div>
            <div className="mt-5 space-y-4">
              <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))} placeholder={copy.newPostPlaceholder} rows={4} className={`w-full rounded-[20px] border border-white/10 bg-background px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-accent/40 focus:outline-none ${isArabic ? 'text-right' : 'text-left'}`} />
              <div className={`text-[11px] text-text-secondary ${isArabic ? 'text-left' : 'text-right'}`}>{newDescription.length}/{DESCRIPTION_MAX_LENGTH}</div>
              <div className="space-y-3">
                <div className={`text-[11px] text-text-secondary ${isArabic ? 'text-right' : 'text-left'}`}>{copy.maxTwoCategories}</div>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORY_OPTIONS.map((option) => {
                    const isSelected = selectedCategories.includes(option);
                    return <button key={option} type="button" onClick={() => toggleCategorySelection(option)} className={`rounded-[18px] border px-3 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98] ${isSelected ? 'border-accent/30 bg-accent/12 text-text-primary shadow-[0_10px_30px_rgb(var(--color-accent)/0.12)]' : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent/20 hover:bg-white/10 hover:text-text-primary'}`}>{copy.categories[option]}</button>;
                  })}
                </div>
              </div>
              {canCreateWomenOnlyPost ? <label className={`flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-text-primary ${isArabic ? 'flex-row-reverse text-right' : 'text-left'}`}><input type="checkbox" checked={newWomenOnly} onChange={(event) => setNewWomenOnly(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-accent focus:ring-accent/40" /><span className="flex-1">{copy.womenOnlyLabel}<span className="mt-1 block text-[11px] text-text-secondary">{copy.womenOnlyHint}</span></span></label> : null}
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/20 px-4 py-4 text-sm text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary ${isArabic ? 'flex-row-reverse' : ''}`}><Upload size={16} />{copy.uploadMedia}<input type="file" accept="image/*" onChange={handleFilePicked} className="hidden" /></label>
              {newMediaUrl ? <div className="overflow-hidden rounded-[20px] border border-white/10 bg-black/20"><img src={newMediaUrl} alt={copy.newPostPreviewAlt} className="max-h-72 w-full object-cover" /></div> : null}
              {createError ? <div className="text-sm text-red-300">{createError}</div> : null}
              <button type="button" onClick={() => { void publishPost(); }} disabled={!canPublish} className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-black transition-all duration-200 hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">{isPublishing ? copy.publishing : copy.publish}</button>
            </div>
          </div>
        </div>
      ) : null}

      {activeCommentsPost ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => { setActiveCommentsPostId(null); setCommentError(''); setReplyToComment(null); }}>
          <div className="w-full max-w-md rounded-t-[32px] border border-white/10 bg-card text-text-primary shadow-2xl sm:max-w-lg sm:rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col items-center px-4 pt-3"><div className="h-1 w-12 rounded-full bg-white/20" /><div className="mt-4 flex w-full items-center justify-between"><div className="w-9" /><h3 className="text-base font-semibold">{copy.commentsTitle}</h3><button type="button" onClick={() => { setActiveCommentsPostId(null); setCommentError(''); setReplyToComment(null); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><X size={16} /></button></div></div>
            <div className="px-4 pt-3 text-xs text-text-secondary">{copy.existingComments(formatCount(activeCommentsPost.comments))}</div>
            <div className="max-h-[45vh] space-y-4 overflow-y-auto px-4 pb-4 pt-4">
              {commentsLoading ? <div className="rounded-[18px] bg-white/5 px-4 py-3 text-sm text-text-secondary">{copy.loadingComments}</div> : localComments.length === 0 ? <div className="rounded-[18px] bg-white/5 px-4 py-3 text-sm text-text-secondary">{copy.noComments}</div> : localComments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3">
                  <img src={resolveCommentAvatar(comment)} alt={copy.avatarAlt(getAuthorName(comment.authorName))} className="h-10 w-10 rounded-full border border-white/10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-text-primary">{getAuthorName(comment.authorName)}</span><span className="text-[11px] text-text-tertiary">{getPostedAgo(comment.createdAt, copy, true)}</span></div>
                    <div className="mt-1 text-sm leading-6 text-text-primary">{comment.text}</div>
                    <button type="button" className="mt-2 text-[11px] text-accent transition-colors hover:text-text-primary" onClick={() => { const name = getAuthorName(comment.authorName); const prefix = `@${name}`; setReplyToComment({ id: comment.id, name }); setNewCommentText((prev) => prev.trim().startsWith(prefix) ? prev : `${prefix} `); requestAnimationFrame(() => { commentInputRef.current?.focus(); }); }}>{copy.reply}</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-white/10 px-4 py-4">
              {replyToComment ? <div className="flex items-center justify-between rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-text-secondary"><span>{copy.replyLabel} {replyToComment.name}</span><button type="button" onClick={() => setReplyToComment(null)} className="text-text-primary"><X size={12} /></button></div> : null}
              <div className="flex items-center gap-2">
                <img src={userProfileImage || DEFAULT_AVATAR} alt={copy.avatarAlt(copy.fallbackUser)} className="h-9 w-9 rounded-full border border-white/10 object-cover" />
                <div className="flex flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-2.5">
                  <input ref={commentInputRef} value={newCommentText} onChange={(event) => setNewCommentText(event.target.value)} placeholder={copy.addCommentPlaceholder} className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none" />
                  <button type="button" onClick={() => { void addComment(); }} className="text-text-primary transition-colors hover:text-accent" aria-label={copy.postComment}><Send size={16} /></button>
                </div>
              </div>
              {commentError ? <div className="text-sm text-red-300">{commentError}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      <CoachmarkOverlay isOpen={isCoachmarkOpen} step={activeCoachmarkStep} stepIndex={coachmarkStepIndex} totalSteps={coachmarkSteps.length} nextLabel={coachmarkCopy.next} finishLabel={coachmarkCopy.finish} skipLabel={coachmarkCopy.skip} onNext={handleCoachmarkNext} onFinish={handleCoachmarkFinish} onSkip={handleCoachmarkSkip} onTargetAction={null} />
    </div>
  );
}
