import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Eye,
  Facebook,
  Heart,
  Instagram,
  MessageCircle,
  MessageCircleMore,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../services/api';

type PostCategory = 'Training' | 'Nutrition' | 'Recovery' | 'Mindset';
type FeedCategory = 'All' | PostCategory;

type FeedCursor = {
  cursorCreatedAt: string;
  cursorId: number;
};

type Post = {
  id: number;
  userId: number;
  authorName: string;
  avatarUrl: string;
  verified: boolean;
  description: string;
  category: PostCategory;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mediaAlt: string;
  createdAt: string | null;
  likedByMe: boolean;
  views: number;
  likes: number;
  comments: number;
};

type BlogComment = {
  id: number;
  postId: number;
  userId: number;
  authorName: string;
  avatarUrl: string;
  text: string;
  createdAt: string | null;
};

type ShareDestination = 'whatsapp' | 'facebook' | 'messages' | 'instagram' | 'copy';

const CATEGORY_OPTIONS: PostCategory[] = ['Training', 'Nutrition', 'Recovery', 'Mindset'];
const CATEGORY_FILTERS: FeedCategory[] = ['All', ...CATEGORY_OPTIONS];
const FEED_PAGE_LIMIT = 20;
const DESCRIPTION_MAX_LENGTH = 5000;
const MEDIA_PAYLOAD_LIMIT = 8000000;

const toCount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const formatCount = (value: number) => {
  const count = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (count < 1000) return new Intl.NumberFormat('en-US').format(Math.round(count));

  if (count >= 1000000000) {
    const formatted = (count / 1000000000).toFixed(count >= 10000000000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, '')}B`;
  }

  if (count >= 1000000) {
    const formatted = (count / 1000000).toFixed(count >= 10000000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, '')}M`;
  }

  const formatted = (count / 1000).toFixed(count >= 10000 ? 0 : 1);
  return `${formatted.replace(/\.0$/, '')}K`;
};

const getPostedAgo = (createdAt: string | null) => {
  if (!createdAt) return 'Posted recently';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Posted recently';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Posted just now';
  if (diffMinutes < 60) return `Posted ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Posted ${diffHours}h ago`;
  return `Posted ${Math.floor(diffHours / 24)}d ago`;
};

const mapPost = (raw: Record<string, unknown>): Post => ({
  id: Number(raw.id || 0),
  userId: Number(raw.userId || 0),
  authorName: String(raw.authorName || 'User'),
  avatarUrl: String(raw.avatarUrl || ''),
  verified: true,
  description: String(raw.description || ''),
  category: CATEGORY_OPTIONS.includes(raw.category as PostCategory) ? (raw.category as PostCategory) : 'Recovery',
  mediaType: raw.mediaType === 'video' ? 'video' : 'image',
  mediaUrl: String(raw.mediaUrl || ''),
  mediaAlt: String(raw.mediaAlt || 'Post media'),
  createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
  likedByMe: Boolean(raw.likedByMe),
  views: toCount((raw.metrics as Record<string, unknown> | undefined)?.views),
  likes: toCount((raw.metrics as Record<string, unknown> | undefined)?.likes),
  comments: toCount((raw.metrics as Record<string, unknown> | undefined)?.comments),
});

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

  if (!cursorCreatedAt) return null;
  if (!Number.isInteger(cursorId) || cursorId <= 0) return null;

  return { cursorCreatedAt, cursorId };
};

const mergePostsById = (current: Post[], incoming: Post[]) => {
  if (!incoming.length) return current;
  if (!current.length) return incoming;

  const existingIds = new Set(current.map((post) => post.id));
  const next = incoming.filter((post) => !existingIds.has(post.id));
  if (!next.length) return current;
  return [...current, ...next];
};

const getUserId = () => {
  const fromKey = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  if (Number.isInteger(fromKey) && fromKey > 0) return fromKey;

  try {
    const raw = localStorage.getItem('appUser') || localStorage.getItem('user') || '{}';
    const user = JSON.parse(raw);
    const inferred = Number(user?.id || user?.userId || 0);
    return Number.isInteger(inferred) && inferred > 0 ? inferred : null;
  } catch {
    return null;
  }
};

const getUserProfileImage = () => {
  try {
    const raw = localStorage.getItem('appUser') || localStorage.getItem('user') || '{}';
    const user = JSON.parse(raw);
    return String(user?.profile_picture || user?.profile_photo || '').trim();
  } catch {
    return '';
  }
};

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=120&q=80';

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const renderDescription = (description: string, overlay = false) =>
  description.split(/(\s+)/).map((chunk, index) => {
    if (!chunk.trim()) return <span key={`sp-${index}`}>{chunk}</span>;
    const isTag = chunk.startsWith('#');
    const cls = isTag
      ? overlay
        ? 'text-[#FFFFFF] font-semibold'
        : 'text-[#2563EB] font-semibold'
      : overlay
        ? 'text-[#FFFFFF]'
        : 'text-[#111827]';
    return (
      <span key={`tx-${index}`} className={cls}>
        {chunk}
      </span>
    );
  });

export function Blogs() {
  const userId = useMemo(() => getUserId(), []);
  const userProfileImage = useMemo(() => getUserProfileImage(), []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<FeedCategory>('All');
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const reelsContainerRef = useRef<HTMLDivElement | null>(null);
  const reelVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const viewedPostIdsRef = useRef<Set<number>>(new Set());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<PostCategory>('Recovery');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [createError, setCreateError] = useState('');

  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, BlogComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [openPostMenuId, setOpenPostMenuId] = useState<number | null>(null);
  const [activeSharePostId, setActiveSharePostId] = useState<number | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');

  const hiddenPostStorageKey = useMemo(() => `blogs:hidden:${userId || 'guest'}`, [userId]);

  const readHiddenPostIds = useCallback(() => {
    try {
      const raw = localStorage.getItem(hiddenPostStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set<number>();
      return new Set(parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0));
    } catch {
      return new Set<number>();
    }
  }, [hiddenPostStorageKey]);

  const writeHiddenPostIds = useCallback((ids: Set<number>) => {
    localStorage.setItem(hiddenPostStorageKey, JSON.stringify(Array.from(ids)));
  }, [hiddenPostStorageKey]);

  const visiblePosts = useMemo(() => {
    if (activeCategory === 'All') return posts;
    return posts.filter((post) => post.category === activeCategory);
  }, [activeCategory, posts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FeedCategory, number> = {
      All: posts.length,
      Training: 0,
      Nutrition: 0,
      Recovery: 0,
      Mindset: 0,
    };

    posts.forEach((post) => {
      counts[post.category] += 1;
    });

    return counts;
  }, [posts]);

  const removePostFromView = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setCommentsByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setOpenPostMenuId((prev) => (prev === postId ? null : prev));
    setActiveSharePostId((prev) => (prev === postId ? null : prev));
    setShareFeedback('');
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      setCommentError('');
    }
    setActiveReelIndex(null);
  }, [activeCommentsPostId]);

  const hidePost = useCallback((postId: number) => {
    const hidden = readHiddenPostIds();
    hidden.add(postId);
    writeHiddenPostIds(hidden);
    removePostFromView(postId);
  }, [readHiddenPostIds, removePostFromView, writeHiddenPostIds]);

  const deleteOwnPost = useCallback(async (postId: number) => {
    if (!userId) return;
    setOpenPostMenuId(null);
    const confirmed = window.confirm('Delete this post? This cannot be undone.');
    if (!confirmed) return;

    try {
      await api.deleteBlogPost(postId, userId);
      removePostFromView(postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    }
  }, [removePostFromView, userId]);

  const loadFeedChunk = useCallback(async (cursor: FeedCursor | null) => {
    if (!userId) {
      throw new Error('Missing logged-in user id. Please login again.');
    }

    const response = await api.getBlogsFeed(userId, {
      limit: FEED_PAGE_LIMIT,
      cursorCreatedAt: cursor?.cursorCreatedAt,
      cursorId: cursor?.cursorId,
    });

    const hiddenIds = readHiddenPostIds();
    const nextPosts = Array.isArray(response?.posts)
      ? response.posts.map(mapPost).filter((post) => !hiddenIds.has(post.id))
      : [];

    const parsedCursor = parseFeedCursor(response?.nextCursor);

    return {
      posts: nextPosts,
      cursor: parsedCursor,
      hasMore: Boolean(response?.hasMore) && Boolean(parsedCursor),
    };
  }, [readHiddenPostIds, userId]);

  const loadInitialFeed = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!userId) {
      setError('Missing logged-in user id. Please login again.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError('');
    try {
      viewedPostIdsRef.current.clear();
      const response = await loadFeedChunk(null);
      setPosts(response.posts);
      setNextCursor(response.cursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog feed');
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, [loadFeedChunk, userId]);

  const loadMoreFeed = useCallback(async () => {
    if (!userId) return;
    if (!hasMore || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError('');
    try {
      const response = await loadFeedChunk(nextCursor);
      setPosts((prev) => mergePostsById(prev, response.posts));
      setNextCursor(response.cursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadFeedChunk, loadingMore, nextCursor, userId]);

  useEffect(() => {
    void loadInitialFeed('initial');
  }, [loadInitialFeed]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-post-menu-root="true"]')) return;
      setOpenPostMenuId(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    setActiveReelIndex(null);
  }, [activeCategory]);

  const trackView = useCallback(
    async (postId: number) => {
      if (!userId) return;
      if (viewedPostIdsRef.current.has(postId)) return;

      viewedPostIdsRef.current.add(postId);
      try {
        const response = await api.trackBlogView(postId, userId);
        const viewsCount = toCount(response?.viewsCount);
        setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, views: viewsCount } : post)));
      } catch {
        viewedPostIdsRef.current.delete(postId);
      }
    },
    [userId],
  );

  const openReelAt = (index: number) => {
    if (!visiblePosts.length) return;
    const bounded = Math.max(0, Math.min(visiblePosts.length - 1, index));
    setActiveReelIndex(bounded);
    const post = visiblePosts[bounded];
    if (post) void trackView(post.id);
  };

  const toggleLike = async (postId: number, mode: 'toggle' | 'like' = 'toggle') => {
    if (!userId) return;

    try {
      const response = await api.toggleBlogLike(postId, { userId, mode });
      const liked = Boolean(response?.liked);
      const likesCount = toCount(response?.likesCount);
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, likedByMe: liked, likes: likesCount } : post)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update like');
    }
  };

  const handleDoubleLike = (postId: number) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || post.likedByMe) return;
    void toggleLike(postId, 'like');
  };

  const loadComments = useCallback(async (postId: number) => {
    setCommentsLoading(true);
    setCommentError('');
    try {
      const response = await api.getBlogComments(postId, 200);
      const comments = Array.isArray(response?.comments) ? response.comments.map(mapComment) : [];
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, comments: comments.length } : post)));
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const openComments = (postId: number) => {
    setActiveCommentsPostId(postId);
    setNewCommentText('');
    setCommentError('');
    void loadComments(postId);
  };

  const getSharePayload = useCallback((post: Post) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/blogs?post=${post.id}`;
    const cleanedDescription = post.description.replace(/\s+/g, ' ').trim();
    const summary = cleanedDescription
      ? cleanedDescription.slice(0, 120).trim() + (cleanedDescription.length > 120 ? '...' : '')
      : 'Check out this post on Gorella.';
    const shareText = `${post.authorName}: ${summary}`;
    return { shareUrl, shareText };
  }, []);

  const copyToClipboard = useCallback(async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (!copied) {
      throw new Error('Copy to clipboard failed');
    }
  }, []);

  const openShareModal = (postId: number) => {
    setActiveSharePostId(postId);
    setShareFeedback('');
  };

  const closeShareModal = () => {
    setActiveSharePostId(null);
    setShareFeedback('');
  };

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
      openUrl(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
      );
      closeShareModal();
      return;
    }

    if (destination === 'messages') {
      window.location.href = `sms:?&body=${encodeURIComponent(shareMessage)}`;
      closeShareModal();
      return;
    }

    if (destination === 'instagram') {
      openUrl('https://www.instagram.com/direct/inbox/');
    }

    try {
      await copyToClipboard(shareMessage);
      setShareFeedback(destination === 'instagram' ? 'Link copied. Paste it into Instagram DM.' : 'Link copied.');
    } catch {
      setShareFeedback('Could not copy link automatically.');
    }
  }, [activeSharePostId, copyToClipboard, getSharePayload, posts]);

  const addComment = async () => {
    if (!activeCommentsPostId || !userId) return;
    const text = newCommentText.trim();
    if (!text) {
      setCommentError('Write a comment before posting.');
      return;
    }

    try {
      const response = await api.addBlogComment(activeCommentsPostId, { userId, text });
      const comment = response?.comment ? mapComment(response.comment) : null;
      const commentsCount = toCount(response?.commentsCount);

      if (comment) {
        setCommentsByPost((prev) => ({
          ...prev,
          [activeCommentsPostId]: [...(prev[activeCommentsPostId] || []), comment],
        }));
      }

      setPosts((prev) =>
        prev.map((post) => (post.id === activeCommentsPostId ? { ...post, comments: commentsCount } : post)),
      );
      setNewCommentText('');
      setCommentError('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment');
    }
  };

  useEffect(() => {
    if (activeReelIndex == null) return;
    if (activeReelIndex >= visiblePosts.length) {
      setActiveReelIndex(null);
    }
  }, [activeReelIndex, visiblePosts.length]);

  useEffect(() => {
    if (activeReelIndex == null) return;
    const container = reelsContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      const h = container.clientHeight || window.innerHeight || 1;
      container.scrollTo({ top: Math.max(0, activeReelIndex * h), behavior: 'auto' });
    });
  }, [activeReelIndex, visiblePosts.length]);

  useEffect(() => {
    if (activeReelIndex == null) return;
    const activePost = visiblePosts[activeReelIndex];
    if (activePost) void trackView(activePost.id);
  }, [activeReelIndex, trackView, visiblePosts]);

  useEffect(() => {
    if (activeReelIndex == null) return;
    const container = reelsContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const h = container.clientHeight || window.innerHeight || 1;
      const index = Math.max(0, Math.min(visiblePosts.length - 1, Math.round(container.scrollTop / h)));
      setActiveReelIndex((prev) => (prev === index ? prev : index));
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [activeReelIndex, visiblePosts.length]);

  useEffect(() => {
    const activePostId = activeReelIndex == null ? null : visiblePosts[activeReelIndex]?.id;
    reelVideoRefs.current.forEach((video, postId) => {
      if (!video) return;
      if (activePostId && postId === activePostId) {
        video.muted = true;
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => null);
      } else {
        video.pause();
      }
    });
  }, [activeReelIndex, visiblePosts]);

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      if (!dataUrl) {
        setCreateError('Failed to read uploaded file.');
        return;
      }
      if (dataUrl.length > MEDIA_PAYLOAD_LIMIT) {
        setCreateError('Media file is too large.');
        return;
      }

      setNewMediaUrl(dataUrl);
      setNewMediaType(file.type.startsWith('video/') ? 'video' : 'image');
      setCreateError('');
    } catch {
      setCreateError('Failed to read uploaded file.');
    }
  };

  const publishPost = async () => {
    if (!userId) {
      setCreateError('Missing logged-in user id. Please login again.');
      return;
    }

    const description = newDescription.trim();
    if (!description) {
      setCreateError('Write a short post description.');
      return;
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setCreateError(`Description is too long (max ${DESCRIPTION_MAX_LENGTH} characters).`);
      return;
    }
    if (!newMediaUrl) {
      setCreateError('Upload an image or video.');
      return;
    }

    setIsPublishing(true);
    setCreateError('');

    try {
      const response = await api.createBlogPost({
        userId,
        description,
        category: newCategory,
        mediaType: newMediaType,
        mediaUrl: newMediaUrl,
        mediaAlt: 'User uploaded media',
      });
      const created = response?.post ? mapPost(response.post) : null;
      if (created) {
        setPosts((prev) => [created, ...prev.filter((post) => post.id !== created.id)]);
        setActiveCategory('All');
      } else {
        await loadInitialFeed('refresh');
      }

      setNewDescription('');
      setNewCategory('Recovery');
      setNewMediaType('image');
      setNewMediaUrl('');
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setIsPublishing(false);
    }
  };

  const activeCommentsPost = activeCommentsPostId
    ? posts.find((post) => post.id === activeCommentsPostId) || null
    : null;
  const activeSharePost = activeSharePostId
    ? posts.find((post) => post.id === activeSharePostId) || null
    : null;
  const localComments = activeCommentsPostId ? commentsByPost[activeCommentsPostId] || [] : [];

  const resolvePostAvatar = (post: Post) => {
    if (post.userId === userId && userProfileImage) return userProfileImage;
    if (post.avatarUrl) return post.avatarUrl;
    return DEFAULT_AVATAR;
  };
  const canPublish = Boolean(newDescription.trim()) && Boolean(newMediaUrl) && !isPublishing;

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-24">
      <div className="mx-auto w-full max-w-4xl bg-transparent px-4 pb-6 pt-4 space-y-4 sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="mt-1 text-xs text-[#6B7280]">Training, nutrition, recovery and mindset updates from the community.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void loadInitialFeed('refresh'); }}
              disabled={refreshing || loading}
              className="w-11 h-11 rounded-full border border-[#D9DDE7] bg-white text-[#111827] flex items-center justify-center hover:border-[#BAC2D4] transition-colors disabled:opacity-60"
              aria-label="Refresh feed"
            >
              <RefreshCcw size={17} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(true);
                setCreateError('');
              }}
              className="w-11 h-11 rounded-full bg-accent text-black flex items-center justify-center shadow-glow hover:opacity-90 transition-opacity"
              aria-label="Create new post"
            >
              <Plus size={20} />
            </button>
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-[#2B6CFF]/60 bg-[#2B6CFF]/15 text-[#1E4EDB]'
                    : 'border-[#D9DDE7] bg-white text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                {category}
                <span className="ml-1.5 text-[11px] opacity-80">{formatCount(categoryCounts[category])}</span>
              </button>
            );
          })}
        </div>

        {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        {loading ? (
          <div className="bg-white border border-[#D9DDE7] rounded-2xl p-4 text-sm text-[#6B7280]">Loading blogs...</div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-[#D9DDE7] rounded-2xl p-4 text-sm text-[#6B7280]">
            <div>No posts yet. Tap + to add your first post.</div>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="bg-white border border-[#D9DDE7] rounded-2xl p-4 text-sm text-[#6B7280] space-y-3">
            <div>No {activeCategory.toLowerCase()} posts in the loaded feed yet.</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="rounded-lg border border-[#D9DDE7] px-3 py-1.5 text-xs text-[#111827] hover:border-[#BAC2D4]"
              >
                Show all categories
              </button>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => { void loadMoreFeed(); }}
                  disabled={loadingMore}
                  className="rounded-lg border border-[#D9DDE7] px-3 py-1.5 text-xs text-[#111827] hover:border-[#BAC2D4] disabled:opacity-60"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          </div>
        ) : (
          visiblePosts.map((post, index) => (
            <article
              key={post.id}
              className="cursor-pointer rounded-[24px] border border-[#E1E5EE] bg-white p-3.5 shadow-[0_12px_26px_rgba(15,23,42,0.08)]"
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('[data-no-open="true"]')) return;
                openReelAt(index);
              }}
              onDoubleClick={() => handleDoubleLike(post.id)}
            >
              <header className="flex min-w-0 items-center gap-3 px-1 pt-1">
                <img
                  src={resolvePostAvatar(post)}
                  alt={`${post.authorName} avatar`}
                  className="h-11 w-11 rounded-full border border-[#D9DDE7] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[17px] font-semibold leading-none text-[#111827]">{post.authorName}</h3>
                  <div className="mt-1 text-xs text-[#6B7280]">{getPostedAgo(post.createdAt).replace('Posted ', '')}</div>
                </div>
                <div className="relative" data-no-open="true" data-post-menu-root="true">
                  <button
                    type="button"
                    data-no-open="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenPostMenuId((prev) => (prev === post.id ? null : post.id));
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#EEF1F7] hover:text-[#111827]"
                    aria-label="Post options"
                  >
                    <MoreHorizontal size={17} />
                  </button>

                  {openPostMenuId === post.id && (
                    <div className="absolute right-0 top-10 z-20 min-w-[140px] overflow-hidden rounded-xl border border-[#D9DDE7] bg-white shadow-xl">
                      {post.userId === userId ? (
                        <button
                          type="button"
                          onClick={() => { void deleteOwnPost(post.id); }}
                          className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete post
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => hidePost(post.id)}
                          className="w-full px-3 py-2.5 text-left text-sm text-[#111827] hover:bg-[#F3F4F6]"
                        >
                          Hide post
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </header>

              <button
                type="button"
                data-no-open="true"
                onClick={() => openReelAt(index)}
                className="group relative mt-3 w-full cursor-pointer overflow-hidden rounded-[18px] border border-[#D9DDE7] bg-[#DCE1EE]"
                style={{ aspectRatio: '4 / 5' }}
              >
                {post.mediaType === 'video' ? (
                  <video
                    src={post.mediaUrl}
                    className="h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.02]"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={post.mediaUrl}
                    alt={post.mediaAlt}
                    className="h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                )}
              </button>

              {post.description.trim() && (
                <div className="mt-3 px-1 text-sm leading-6 text-[#111827]">{renderDescription(post.description)}</div>
              )}

              <footer className="mt-3 flex items-center justify-between px-1 pb-1">
                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <Eye size={16} />
                    <span>{formatCount(post.views)}</span>
                  </div>
                  <button
                    type="button"
                    data-no-open="true"
                    onClick={() => {
                      void toggleLike(post.id, 'toggle');
                    }}
                    className="inline-flex items-center gap-2 text-sm text-[#6B7280]"
                  >
                    <Heart size={17} className={post.likedByMe ? 'fill-rose-500 text-rose-500' : ''} />
                    <span className="font-semibold text-[#111827]">{formatCount(post.likes)}</span>
                  </button>

                  <button
                    type="button"
                    data-no-open="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      openComments(post.id);
                    }}
                    className="inline-flex items-center gap-2 text-sm text-[#6B7280]"
                  >
                    <MessageCircle size={17} />
                    <span className="font-semibold text-[#111827]">{formatCount(post.comments)}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[#6B7280]">
                  <button
                    type="button"
                    data-no-open="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      openShareModal(post.id);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#EEF1F7]"
                    aria-label="Share post"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </footer>
            </article>
          ))
        )}

        {!loading && posts.length > 0 && visiblePosts.length > 0 && hasMore && (
          <button
            type="button"
            onClick={() => { void loadMoreFeed(); }}
            disabled={loadingMore}
            className="w-full rounded-xl border border-[#D9DDE7] bg-white px-4 py-3 text-sm text-[#111827] hover:border-[#BAC2D4] transition-colors disabled:opacity-60"
          >
            {loadingMore ? 'Loading more posts...' : 'Load more posts'}
          </button>
        )}

        {!loading && posts.length > 0 && visiblePosts.length > 0 && !hasMore && (
          <div className="py-2 text-center text-xs text-[#6B7280]">You are all caught up.</div>
        )}
      </div>

      {activeReelIndex != null && (
        <div className="fixed inset-0 z-[60] bg-black">
          <button
            type="button"
            onClick={() => setActiveReelIndex(null)}
            className="fixed top-4 right-4 z-[95] w-12 h-12 rounded-full bg-black/80 border-2 border-[#FFFFFF] hover:bg-black text-[#FFFFFF] shadow-[0_0_18px_rgba(0,0,0,0.55)] backdrop-blur-sm flex items-center justify-center"
            aria-label="Close full screen posts"
          >
            <X size={20} className="text-[#FFFFFF]" />
          </button>

          <div ref={reelsContainerRef} className="h-screen overflow-y-auto snap-y snap-mandatory">
            {visiblePosts.map((post, index) => (
              <section
                key={`${post.id}-reel-${index}`}
                className="relative h-screen snap-start bg-black"
                onDoubleClick={() => handleDoubleLike(post.id)}
              >
                {post.mediaType === 'video' ? (
                  <video
                    src={post.mediaUrl}
                    autoPlay={index === activeReelIndex}
                    muted
                    playsInline
                    ref={(node) => {
                      if (node) reelVideoRefs.current.set(post.id, node);
                      else reelVideoRefs.current.delete(post.id);
                    }}
                    onClick={(event) => {
                      const video = event.currentTarget;
                      if (video.paused) {
                        const p = video.play();
                        if (p && typeof p.catch === 'function') p.catch(() => null);
                      } else {
                        video.pause();
                      }
                    }}
                    className="h-full w-full object-contain cursor-pointer"
                  />
                ) : (
                  <img src={post.mediaUrl} alt={post.mediaAlt} className="h-full w-full object-contain" />
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pb-8 pt-16">
                  <div className="flex items-center gap-3">
                    <img
                      src={resolvePostAvatar(post)}
                      alt={`${post.authorName} avatar`}
                      className="w-10 h-10 rounded-full object-cover border border-white/20"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-[#FFFFFF] truncate">{post.authorName}</h3>
                      </div>
                      <div className="text-xs text-[#FFFFFF]">{getPostedAgo(post.createdAt)}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#FFFFFF]">{renderDescription(post.description, true)}</p>

                  <div className="mt-3 flex items-center gap-5 text-[#FFFFFF]">
                    <div className="inline-flex items-center gap-1.5 text-xs">
                      <Eye size={16} />
                      <span>{formatCount(post.views)}</span>
                    </div>
                    <button type="button" onClick={() => { void toggleLike(post.id, 'toggle'); }} className="inline-flex items-center gap-1.5 text-xs">
                      <Heart size={16} className={post.likedByMe ? 'text-rose-400 fill-rose-400' : ''} />
                      <span>{formatCount(post.likes)}</span>
                    </button>
                    <button type="button" onClick={() => openComments(post.id)} className="inline-flex items-center gap-1.5 text-xs">
                      <MessageCircle size={16} />
                      <span>{formatCount(post.comments)}</span>
                    </button>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      {activeSharePost && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 p-4 flex items-end sm:items-center justify-center"
          onClick={closeShareModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#D9DDE7] bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111827]">Share Post</h3>
              <button
                type="button"
                onClick={closeShareModal}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#EEF1F7] hover:text-[#111827]"
                aria-label="Close share modal"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-[#6B7280]">
              {activeSharePost.description.trim()
                ? `${activeSharePost.description.trim().slice(0, 90)}${activeSharePost.description.trim().length > 90 ? '...' : ''}`
                : 'Choose where you want to share this post.'}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { void sharePostTo('whatsapp'); }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#D9DDE7] px-2 py-3 text-[#111827] hover:border-[#BAC2D4] hover:bg-[#F8FAFC]"
              >
                <MessageCircleMore size={20} className="text-[#25D366]" />
                <span className="text-[11px] font-medium leading-none">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => { void sharePostTo('facebook'); }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#D9DDE7] px-2 py-3 text-[#111827] hover:border-[#BAC2D4] hover:bg-[#F8FAFC]"
              >
                <Facebook size={20} className="text-[#1877F2]" />
                <span className="text-[11px] font-medium leading-none">Facebook</span>
              </button>
              <button
                type="button"
                onClick={() => { void sharePostTo('instagram'); }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#D9DDE7] px-2 py-3 text-[#111827] hover:border-[#BAC2D4] hover:bg-[#F8FAFC]"
              >
                <Instagram size={20} className="text-[#E1306C]" />
                <span className="text-[11px] font-medium leading-none">Instagram</span>
              </button>
              <button
                type="button"
                onClick={() => { void sharePostTo('copy'); }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#D9DDE7] px-2 py-3 text-[#111827] hover:border-[#BAC2D4] hover:bg-[#F8FAFC]"
              >
                <Copy size={20} className="text-[#374151]" />
                <span className="text-[11px] font-medium leading-none">Copy Link</span>
              </button>
            </div>

            {shareFeedback && <p className="mt-2 text-xs text-[#2563EB]">{shareFeedback}</p>}
          </div>
        </div>
      )}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4 flex items-center justify-center"
          onClick={() => {
            setIsCreateOpen(false);
            setCreateError('');
          }}
        >
          <div className="w-full max-w-md bg-card rounded-2xl border border-white/10 p-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">New Post</h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateError('');
                }}
                className="w-8 h-8 rounded-full bg-white/10 text-[#FFFFFF] flex items-center justify-center"
              >
                <X size={16} className="text-[#FFFFFF]" />
              </button>
            </div>

            <div className="space-y-3">
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                placeholder="Share your update..."
                rows={4}
                className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
              />
              <div className="text-[11px] text-text-secondary text-right">{newDescription.length}/{DESCRIPTION_MAX_LENGTH}</div>

              <select
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value as PostCategory)}
                className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent/60"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>

              <label className="flex items-center justify-center gap-2 w-full border border-dashed border-white/20 rounded-xl px-3 py-3 text-sm text-text-secondary cursor-pointer hover:border-accent/60 hover:text-white transition-colors">
                <Upload size={16} />
                Upload image or video
                <input type="file" accept="image/*,video/*" onChange={handleFilePicked} className="hidden" />
              </label>

              {newMediaUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
                  {newMediaType === 'video' ? (
                    <video src={newMediaUrl} controls className="w-full max-h-56 object-contain" />
                  ) : (
                    <img src={newMediaUrl} alt="New post preview" className="w-full max-h-56 object-contain" />
                  )}
                </div>
              )}

              {createError && <div className="text-sm text-red-300">{createError}</div>}

              <button
                type="button"
                onClick={() => { void publishPost(); }}
                disabled={!canPublish}
                className="w-full py-2.5 rounded-xl bg-accent text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPublishing ? 'Publishing...' : 'Publish Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCommentsPost && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 p-4 flex items-end sm:items-center justify-center"
          onClick={() => {
            setActiveCommentsPostId(null);
            setCommentError('');
          }}
        >
          <div className="w-full max-w-md bg-card rounded-2xl border border-white/10 p-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">Comments</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveCommentsPostId(null);
                  setCommentError('');
                }}
                className="w-8 h-8 rounded-full bg-white/10 text-[#FFFFFF] flex items-center justify-center"
              >
                <X size={16} className="text-[#FFFFFF]" />
              </button>
            </div>

            <div className="text-xs text-text-secondary mb-2">Existing comments: {formatCount(activeCommentsPost.comments)}</div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {commentsLoading ? (
                <div className="text-sm text-text-secondary bg-white/5 rounded-lg px-3 py-2">Loading comments...</div>
              ) : localComments.length === 0 ? (
                <div className="text-sm text-text-secondary bg-white/5 rounded-lg px-3 py-2">No comments yet. Add one below.</div>
              ) : (
                localComments.map((comment) => (
                  <div key={comment.id} className="bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">{comment.authorName}</div>
                      <div className="text-[11px] text-text-secondary">{getPostedAgo(comment.createdAt).replace('Posted ', '')}</div>
                    </div>
                    <div className="text-sm text-text-primary mt-1">{comment.text}</div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 space-y-2">
              <textarea
                value={newCommentText}
                onChange={(event) => setNewCommentText(event.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
              />

              {commentError && <div className="text-sm text-red-300">{commentError}</div>}

              <button
                type="button"
                onClick={() => { void addComment(); }}
                className="w-full py-2.5 rounded-xl bg-accent text-black font-semibold hover:opacity-90 transition-opacity"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
