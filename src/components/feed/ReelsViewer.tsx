import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Heart, MessageCircle, Send, X } from 'lucide-react';
import { playMediaSafely } from '../../shared/mediaPlayback';
import type { Post, ReactionOption, ReactionType } from './types';

type ReelsViewerProps = {
  posts: Post[];
  initialIndex: number;
  isSaved: (postId: number) => boolean;
  onClose: () => void;
  onReact: (postId: number, reactionType: ReactionType | null) => void;
  onDoubleLike: (postId: number) => void;
  onComments: (postId: number) => void;
  onShare: (postId: number) => void;
  onSave: (postId: number) => void;
  onTrackView: (postId: number) => void;
  reactionOptions: ReactionOption[];
  resolveAvatar: (post: Post) => string;
  getAuthorName: (name: string) => string;
  getPostedAgo: (createdAt: string | null, short?: boolean) => string;
  formatCount: (value: number) => string;
  copy: {
    avatarAlt: (name: string) => string;
    closeFullScreen: string;
    reactToPost: string;
    mediaAlt: string;
  };
};

export default function ReelsViewer({
  posts,
  initialIndex,
  isSaved,
  onClose,
  onReact,
  onDoubleLike,
  onComments,
  onShare,
  onSave,
  onTrackView,
  reactionOptions,
  resolveAvatar,
  getAuthorName,
  getPostedAgo,
  formatCount,
  copy,
}: ReelsViewerProps) {
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, Math.min(posts.length - 1, initialIndex)));
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reelVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      const height = container.clientHeight || window.innerHeight || 1;
      container.scrollTo({ top: Math.max(0, activeIndex * height), behavior: 'auto' });
    });
  }, [activeIndex]);

  useEffect(() => {
    const activePost = posts[activeIndex];
    if (activePost) onTrackView(activePost.id);
  }, [activeIndex, onTrackView, posts]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const onScroll = () => {
      const height = container.clientHeight || window.innerHeight || 1;
      const nextIndex = Math.max(0, Math.min(posts.length - 1, Math.round(container.scrollTop / height)));
      setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [posts.length]);

  useEffect(() => {
    const activePostId = posts[activeIndex]?.id ?? null;
    reelVideoRefs.current.forEach((video, postId) => {
      if (!video) return;
      if (postId === activePostId) {
        video.muted = true;
        void playMediaSafely(video);
      } else {
        video.pause();
      }
    });
  }, [activeIndex, posts]);

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur transition-all duration-200 hover:bg-black active:scale-95"
        aria-label={copy.closeFullScreen}
      >
        <X size={20} />
      </button>

      <div ref={containerRef} className="mobile-dvh-screen snap-y snap-mandatory overflow-y-auto">
        {posts.map((post, index) => {
          const authorName = getAuthorName(post.authorName);
          const reactionMenuOpen = openReactionPostId === post.id;

          return (
            <section
              key={`${post.id}-${index}`}
              className="mobile-dvh-screen relative snap-start bg-black"
              onDoubleClick={() => onDoubleLike(post.id)}
            >
              {post.mediaType === 'video' ? (
                <video
                  src={post.mediaFull}
                  poster={post.mediaThumbnail}
                  autoPlay={index === activeIndex}
                  muted
                  playsInline
                  preload={index === activeIndex ? 'auto' : 'metadata'}
                  ref={(node) => {
                    if (node) reelVideoRefs.current.set(post.id, node);
                    else reelVideoRefs.current.delete(post.id);
                  }}
                  onClick={(event) => {
                    const video = event.currentTarget;
                    if (video.paused) {
                      void playMediaSafely(video);
                    } else {
                      video.pause();
                    }
                  }}
                  className="h-full w-full cursor-pointer object-contain"
                />
              ) : (
                <img src={post.mediaFull} alt={post.mediaAlt || copy.mediaAlt} className="h-full w-full object-contain" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent px-4 pb-8 pt-20 sm:px-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveAvatar(post)}
                        alt={copy.avatarAlt(authorName)}
                        className="h-11 w-11 rounded-full border border-white/20 object-cover"
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">{authorName}</h3>
                        <p className="mt-1 text-xs text-white/70">
                          {getPostedAgo(post.createdAt, true)} • {post.category}
                        </p>
                      </div>
                    </div>

                    {post.caption.trim() ? (
                      <p className="mt-4 max-w-xl text-sm leading-6 text-white/90">{post.caption}</p>
                    ) : null}

                    <div className="mt-4 text-xs text-white/70">
                      {formatCount(post.likes)} likes • {formatCount(post.comments)} comments • {formatCount(post.views)} views
                    </div>
                  </div>

                  <div className="relative flex flex-col gap-3" data-reaction-menu-root="true">
                    <button
                      type="button"
                      onClick={() => setOpenReactionPostId((current) => (current === post.id ? null : post.id))}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-all duration-200 hover:bg-white/15 active:scale-95"
                      aria-label={copy.reactToPost}
                    >
                      {post.reactionByMe ? (
                        <img src={reactionOptions.find((item) => item.type === post.reactionByMe)?.image} alt="" className="h-6 w-6" />
                      ) : (
                        <Heart size={20} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onComments(post.id)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-all duration-200 hover:bg-white/15 active:scale-95"
                    >
                      <MessageCircle size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onShare(post.id)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-all duration-200 hover:bg-white/15 active:scale-95"
                    >
                      <Send size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSave(post.id)}
                      className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition-all duration-200 active:scale-95 ${
                        isSaved(post.id) ? 'bg-accent text-black shadow-glow' : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <Bookmark size={20} className={isSaved(post.id) ? 'fill-current' : ''} />
                    </button>

                    {reactionMenuOpen ? (
                      <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2 rounded-[22px] border border-white/10 bg-black/75 p-2 shadow-2xl backdrop-blur">
                        {reactionOptions.map((reaction) => {
                          const isActive = post.reactionByMe === reaction.type;
                          return (
                            <button
                              key={reaction.type}
                              type="button"
                              onClick={() => {
                                onReact(post.id, isActive ? null : reaction.type);
                                setOpenReactionPostId(null);
                              }}
                              className={`flex h-12 w-12 items-center justify-center rounded-full ${isActive ? 'bg-white/15' : 'hover:bg-white/10'}`}
                              aria-label={reaction.label}
                            >
                              <img src={reaction.image} alt={reaction.label} className="h-7 w-7" />
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
