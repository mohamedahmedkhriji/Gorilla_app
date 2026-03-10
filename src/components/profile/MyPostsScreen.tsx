import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { ModernSelect } from '../ui/ModernSelect';

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

const formatRelativeDay = (value: string | null) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startNow - startThen) / (24 * 60 * 60 * 1000));
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff}d ago`;
  return date.toLocaleDateString();
};

interface MyPostsScreenProps {
  onBack: () => void;
}

export function MyPostsScreen({ onBack }: MyPostsScreenProps) {
  const userId = useMemo(() => resolveUserId(), []);

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

  const loadInitial = useCallback(async () => {
    if (!userId) {
      setError('Missing logged-in user id. Please login again.');
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
      setError(err instanceof Error ? err.message : 'Failed to load your posts');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
      setError(err instanceof Error ? err.message : 'Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextCursor, userId]);

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
      setEditError('Description is required.');
      return;
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setEditError(`Description is too long (max ${DESCRIPTION_MAX_LENGTH} chars).`);
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
      setEditError(err instanceof Error ? err.message : 'Failed to save post changes');
    } finally {
      setSavingEdit(false);
    }
  };

  const deletePost = async (postId: number) => {
    if (!userId || deletingPostId) return;
    const confirmed = window.confirm('Delete this post? This cannot be undone.');
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
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="My Blog Posts" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 space-y-3">
        {error && (
          <Card className="!p-3 text-sm text-red-300 border border-red-400/30 bg-red-500/10">{error}</Card>
        )}

        {loading ? (
          <Card className="!p-3 text-sm text-text-secondary">Loading your posts...</Card>
        ) : posts.length === 0 ? (
          <Card className="!p-3 text-sm text-text-secondary">You have not uploaded any blog posts yet.</Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} className="!p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-text-secondary">{formatRelativeDay(post.createdAt)}</div>
                  <div className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-text-secondary">
                    {post.category}
                  </div>
                </div>

                {post.mediaUrl && (
                  post.mediaType === 'video' ? (
                    <video
                      src={post.mediaUrl}
                      className="w-full rounded-xl border border-white/10 bg-black/20 max-h-72 object-contain"
                      controls
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
                  {new Intl.NumberFormat('en-US').format(post.likes)} likes - {' '}
                  {new Intl.NumberFormat('en-US').format(post.comments)} comments - {' '}
                  {new Intl.NumberFormat('en-US').format(post.views)} views
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(post)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingPostId === post.id}
                    onClick={() => { void deletePost(post.id); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-60"
                  >
                    {deletingPostId === post.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {deletingPostId === post.id ? 'Deleting...' : 'Delete'}
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
            {loadingMore ? 'Loading more posts...' : 'Load more posts'}
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
            <h3 className="text-lg font-semibold text-white">Edit Post</h3>

            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
              rows={5}
              placeholder="Update your post description..."
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
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void saveEdit(); }}
                disabled={savingEdit || !editDescription.trim()}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
