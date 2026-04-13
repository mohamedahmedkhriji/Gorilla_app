import React, { useEffect, useRef } from 'react';
import PostCard from './PostCard';
import PostSkeleton from './PostSkeleton';
import type { Post, ReactionOption, ReactionType } from './types';

type FeedListProps = {
  posts: Post[];
  currentUserId: number;
  savedPostIds: Set<number>;
  reactionOptions: ReactionOption[];
  openMenuId: number | null;
  openReactionPostId: number | null;
  loadingMore: boolean;
  hasMore: boolean;
  caughtUpLabel: string;
  loadingMoreLabel: string;
  copy: {
    avatarAlt: (name: string) => string;
    mediaAlt: string;
    womenOnly: string;
    postOptions: string;
    deletePost: string;
    hidePost: string;
    reactToPost: string;
    save: string;
    saved: string;
    share: string;
  };
  getAuthorName: (name: string) => string;
  getPostedAgo: (createdAt: string | null, short?: boolean) => string;
  resolveAvatar: (post: Post) => string;
  formatCount: (value: number) => string;
  onLoadMore: () => void;
  onOpenPost: (index: number) => void;
  onDoubleLike: (postId: number) => void;
  onToggleMenu: (postId: number) => void;
  onToggleReactions: (postId: number) => void;
  onReact: (postId: number, reactionType: ReactionType | null) => void;
  onComments: (postId: number) => void;
  onShare: (postId: number) => void;
  onSave: (postId: number) => void;
  onDelete: (postId: number) => void;
  onHide: (postId: number) => void;
};

export default function FeedList({
  posts,
  currentUserId,
  savedPostIds,
  reactionOptions,
  openMenuId,
  openReactionPostId,
  loadingMore,
  hasMore,
  caughtUpLabel,
  loadingMoreLabel,
  copy,
  getAuthorName,
  getPostedAgo,
  resolveAvatar,
  formatCount,
  onLoadMore,
  onOpenPost,
  onDoubleLike,
  onToggleMenu,
  onToggleReactions,
  onReact,
  onComments,
  onShare,
  onSave,
  onDelete,
  onHide,
}: FeedListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || !sentinelRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '900px 0px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, posts.length]);

  return (
    <div className="space-y-5">
      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          index={index}
          currentUserId={currentUserId}
          isSaved={savedPostIds.has(post.id)}
          priorityMedia={index === 0}
          reactionOptions={reactionOptions}
          openMenu={openMenuId === post.id}
          openReactions={openReactionPostId === post.id}
          getAuthorName={getAuthorName}
          getPostedAgo={getPostedAgo}
          resolveAvatar={resolveAvatar}
          formatCount={formatCount}
          onOpen={() => onOpenPost(index)}
          onDoubleLike={() => onDoubleLike(post.id)}
          onToggleMenu={() => onToggleMenu(post.id)}
          onToggleReactions={() => onToggleReactions(post.id)}
          onReact={(reactionType) => onReact(post.id, reactionType)}
          onComments={() => onComments(post.id)}
          onShare={() => onShare(post.id)}
          onSave={() => onSave(post.id)}
          onDelete={() => onDelete(post.id)}
          onHide={() => onHide(post.id)}
          copy={copy}
        />
      ))}

      <div ref={sentinelRef} className="h-1 w-full" />

      {loadingMore ? (
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <PostSkeleton key={`feed-loading-${index}`} />
          ))}
          <div className="py-2 text-center text-xs text-text-secondary">{loadingMoreLabel}</div>
        </div>
      ) : null}

      {!hasMore && posts.length > 0 ? (
        <div className="py-3 text-center text-xs text-text-secondary">{caughtUpLabel}</div>
      ) : null}
    </div>
  );
}
