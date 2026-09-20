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
  themeVariant?: 'default' | 'girls';
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
  themeVariant = 'default',
}: ReelsViewerProps) {
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, Math.min(posts.length - 1, initialIndex)));
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reelVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const isGirlsTheme = themeVariant === 'girls';
  const actionButtonClassName = isGirlsTheme
    ? 'flex h-12 w-12 items-center justify-center rounded-full border border-[#E2B4BD]/45 bg-white/70 text-[#4A4A4A] shadow-[0_10px_22px_rgba(226,180,189,0.16)] backdrop-blur transition-all duration-200 hover:border-[#F9B2D7]/70 hover:bg-white/85 active:scale-95'
    : 'flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-all duration-200 hover:bg-white/15 active:scale-95';

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
    <div className={`fixed inset-0 z-[60] ${isGirlsTheme ? 'bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.22),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(207,236,243,0.34),transparent_32%),linear-gradient(180deg,#FFF5F5_0%,#F7D6D0_52%,#FFF5F5_100%)]' : 'bg-black'}`}>
      <button
        type="button"
        onClick={onClose}
        className={`fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[70] flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur transition-all duration-200 active:scale-95 ${isGirlsTheme ? 'border-[#E2B4BD]/55 bg-white/75 text-[#4A4A4A] shadow-[0_12px_26px_rgba(226,180,189,0.18)] hover:border-[#F9B2D7]/70 hover:bg-white/90' : 'border-white/20 bg-black/70 text-white hover:bg-black'}`}
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
              className={`mobile-dvh-screen relative snap-start ${isGirlsTheme ? 'bg-[#FFF5F5]' : 'bg-black'}`}
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
                  className={`h-full w-full cursor-pointer object-contain ${isGirlsTheme ? 'bg-[#FFF5F5]' : ''}`}
                />
              ) : (
                <img src={post.mediaFull} alt={post.mediaAlt || copy.mediaAlt} className={`h-full w-full object-contain ${isGirlsTheme ? 'bg-[#FFF5F5]' : ''}`} />
              )}

              <div className={`absolute inset-x-0 bottom-0 px-4 pb-8 pt-20 sm:px-6 ${isGirlsTheme ? 'bg-gradient-to-t from-[#FFF5F5] via-[#FFF5F5]/84 to-transparent' : 'bg-gradient-to-t from-black via-black/65 to-transparent'}`}>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveAvatar(post)}
                        alt={copy.avatarAlt(authorName)}
                        className={`h-11 w-11 rounded-full border object-cover ${isGirlsTheme ? 'border-[#E2B4BD]/55' : 'border-white/20'}`}
                      />
                      <div className="min-w-0">
                        <h3 className={`truncate text-sm font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{authorName}</h3>
                        <p className={`mt-1 text-xs ${isGirlsTheme ? 'text-[#795E67]' : 'text-white/70'}`}>
                          {getPostedAgo(post.createdAt, true)} • {post.category}
                        </p>
                      </div>
                    </div>

                    {post.caption.trim() ? (
                      <p className={`mt-4 max-w-xl text-sm leading-6 ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white/90'}`}>{post.caption}</p>
                    ) : null}

                    <div className={`mt-4 text-xs ${isGirlsTheme ? 'text-[#795E67]' : 'text-white/70'}`}>
                      {formatCount(post.likes)} likes • {formatCount(post.comments)} comments • {formatCount(post.views)} views
                    </div>
                  </div>

                  <div className="relative flex flex-col gap-3" data-reaction-menu-root="true">
                    <button
                      type="button"
                      onClick={() => setOpenReactionPostId((current) => (current === post.id ? null : post.id))}
                      className={actionButtonClassName}
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
                      className={actionButtonClassName}
                    >
                      <MessageCircle size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onShare(post.id)}
                      className={actionButtonClassName}
                    >
                      <Send size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSave(post.id)}
                      className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition-all duration-200 active:scale-95 ${
                        isSaved(post.id)
                          ? isGirlsTheme
                            ? 'border border-[#F9B2D7]/70 bg-[#F9B2D7] text-[#4A4A4A] shadow-[0_10px_24px_rgba(249,178,215,0.30)]'
                            : 'bg-accent text-black shadow-glow'
                          : isGirlsTheme
                            ? 'border border-[#E2B4BD]/45 bg-white/70 text-[#4A4A4A] shadow-[0_10px_22px_rgba(226,180,189,0.16)] hover:border-[#F9B2D7]/70 hover:bg-white/85'
                            : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <Bookmark size={20} className={isSaved(post.id) ? 'fill-current' : ''} />
                    </button>

                    {reactionMenuOpen ? (
                      <div className={`absolute bottom-full right-0 mb-3 flex flex-col gap-2 rounded-[22px] border p-2 shadow-2xl backdrop-blur ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-[#FFF5F5]/90' : 'border-white/10 bg-black/75'}`}>
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
                              className={`flex h-12 w-12 items-center justify-center rounded-full ${isGirlsTheme ? (isActive ? 'bg-[#F9B2D7]/25' : 'hover:bg-[#F9B2D7]/16') : (isActive ? 'bg-white/15' : 'hover:bg-white/10')}`}
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
