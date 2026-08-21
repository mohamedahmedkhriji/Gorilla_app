import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, MessageCircle, MoreHorizontal, Send } from 'lucide-react';
import type { Post, ReactionOption, ReactionType } from './types';

type PostCardProps = {
  post: Post;
  index: number;
  currentUserId: number;
  isSaved: boolean;
  priorityMedia: boolean;
  reactionOptions: ReactionOption[];
  openMenu: boolean;
  openReactions: boolean;
  getAuthorName: (name: string) => string;
  getPostedAgo: (createdAt: string | null, short?: boolean) => string;
  resolveAvatar: (post: Post) => string;
  formatCount: (value: number) => string;
  onOpen: () => void;
  onDoubleLike: () => void;
  onToggleMenu: () => void;
  onToggleReactions: () => void;
  onReact: (reactionType: ReactionType | null) => void;
  onComments: () => void;
  onShare: () => void;
  onSave: () => void;
  onDelete: () => void;
  onHide: () => void;
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
};

const REACTION_ANIMATION_COLORS: Record<ReactionType, string> = {
  love: 'rgb(255 91 137)',
  fire: 'rgb(249 115 22)',
  power: 'rgb(var(--color-accent))',
  wow: 'rgb(250 204 21)',
};

function AnimatedReactionIcon({
  reaction,
  image,
}: {
  reaction: ReactionType | null;
  image?: string;
}) {
  const active = Boolean(reaction);
  const color = reaction ? REACTION_ANIMATION_COLORS[reaction] : 'rgb(255 91 137)';
  const [animationVersion, setAnimationVersion] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return undefined;
    }

    if (!reaction) {
      setIsAnimating(false);
      return undefined;
    }

    setAnimationVersion((version) => version + 1);
    setIsAnimating(true);

    const timeoutId = window.setTimeout(() => {
      setIsAnimating(false);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reaction]);

  return (
    <span
      key={reaction || 'empty'}
      className={`animated-reaction-icon ${active ? 'is-active' : ''} ${isAnimating ? 'is-animating' : ''}`}
      style={{ '--reaction-color': color } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="animated-reaction-icon__wrap">
        <svg viewBox="0 0 24 24" className="animated-reaction-icon__outline" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Zm-3.585,18.4a2.973,2.973,0,0,1-3.83,0C4.947,16.006,2,11.87,2,8.967a4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,11,8.967a1,1,0,0,0,2,0,4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,22,8.967C22,11.87,19.053,16.006,13.915,20.313Z" />
        </svg>
        {reaction === 'love' ? (
          <svg key={`heart-${animationVersion}`} viewBox="0 0 24 24" className="animated-reaction-icon__filled-heart" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Z" />
          </svg>
        ) : image ? (
          <img key={`image-${animationVersion}`} src={image} alt="" className="animated-reaction-icon__image" />
        ) : null}
        <svg key={`celebrate-${animationVersion}`} viewBox="0 0 100 100" className="animated-reaction-icon__celebrate" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 10 22 22" />
          <path d="M8 50h16" />
          <path d="M20 82 34 68" />
          <path d="M90 10 78 22" />
          <path d="M92 50H76" />
          <path d="M80 82 66 68" />
        </svg>
      </span>
    </span>
  );
}

export default function PostCard({
  post,
  index,
  currentUserId,
  isSaved,
  priorityMedia,
  reactionOptions,
  openMenu,
  openReactions,
  getAuthorName,
  getPostedAgo,
  resolveAvatar,
  formatCount,
  onOpen,
  onDoubleLike,
  onToggleMenu,
  onToggleReactions,
  onReact,
  onComments,
  onShare,
  onSave,
  onDelete,
  onHide,
  copy,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);

  const authorName = getAuthorName(post.authorName);
  const caption = post.caption.trim();
  const canExpand = caption.length > 140;
  const displayedCaption = expanded || !canExpand ? caption : `${caption.slice(0, 140).trim()}...`;
  const meta = useMemo(
    () => `${formatCount(post.likes)} likes • ${formatCount(post.comments)} comments`,
    [formatCount, post.comments, post.likes],
  );
  const selectedReactionOption = reactionOptions.find((item) => item.type === post.reactionByMe);

  return (
    <article
      data-coachmark-target={index === 0 ? 'blogs_first_post_card' : undefined}
      className="group overflow-hidden rounded-[24px] border border-white/10 bg-card/95 shadow-[0_18px_50px_rgb(5_10_20/0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/18 hover:shadow-[0_24px_60px_rgb(5_10_20/0.18)]"
      onDoubleClick={onDoubleLike}
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <img
          src={resolveAvatar(post)}
          alt={copy.avatarAlt(authorName)}
          className="h-11 w-11 rounded-full border border-white/10 object-cover"
          loading={index < 2 ? 'eager' : 'lazy'}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-text-primary">{authorName}</h3>
            {post.womenOnly ? (
              <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                {copy.womenOnly}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-text-secondary">
            {getPostedAgo(post.createdAt, true)} • {post.category}
          </p>
        </div>

        <div className="relative" data-no-open="true" data-post-menu-root="true">
          <button
            type="button"
            onClick={onToggleMenu}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-all duration-200 hover:bg-white/10 hover:text-text-primary active:scale-95"
            aria-label={copy.postOptions}
          >
            <MoreHorizontal size={16} />
          </button>

          {openMenu ? (
            <div className="absolute right-0 top-11 z-20 min-w-[150px] overflow-hidden rounded-2xl border border-white/10 bg-[#101826]/95 p-1.5 shadow-2xl backdrop-blur">
              {post.userId === currentUserId ? (
                <button
                  type="button"
                  onClick={onDelete}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
                >
                  {copy.deletePost}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onHide}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-white/5"
                >
                  {copy.hidePost}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {caption ? (
        <div className="px-4 pb-3">
          <p className={`text-sm leading-6 text-text-primary ${expanded ? '' : '[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:3]'}`}>
            {displayedCaption}
          </p>
          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 text-xs font-medium text-accent transition-colors hover:text-text-primary"
            >
              {expanded ? 'Less' : 'More'}
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full overflow-hidden bg-white/[0.03] text-left active:scale-[0.995]"
        style={{ aspectRatio: post.mediaAspectRatio }}
      >
        {!mediaLoaded ? (
          <div className="absolute inset-0 animate-pulse bg-white/10" />
        ) : null}

        {post.mediaType === 'video' ? (
          <video
            src={post.mediaFull}
            poster={post.mediaThumbnail}
            preload={priorityMedia ? 'auto' : 'metadata'}
            muted
            playsInline
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
            onLoadedData={() => setMediaLoaded(true)}
          />
        ) : (
          <>
            {post.mediaThumbnail ? (
              <img
                src={post.mediaThumbnail}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 h-full w-full scale-110 object-cover blur-2xl transition-opacity duration-300 ${
                  mediaLoaded ? 'opacity-0' : 'opacity-35'
                }`}
              />
            ) : null}
            <img
              src={post.mediaThumbnail || post.mediaFull}
              alt={post.mediaAlt || copy.mediaAlt}
              loading={priorityMedia ? 'eager' : 'lazy'}
              fetchPriority={priorityMedia ? 'high' : 'auto'}
              decoding="async"
              className="relative h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
              onLoad={() => setMediaLoaded(true)}
            />
          </>
        )}
      </button>

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative" data-no-open="true" data-reaction-menu-root="true">
              <button
                type="button"
                onClick={onToggleReactions}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-primary transition-all duration-200 hover:bg-white/10 active:scale-95"
                aria-label={copy.reactToPost}
              >
                <AnimatedReactionIcon reaction={post.reactionByMe} image={selectedReactionOption?.image} />
              </button>

              {openReactions ? (
                <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-[#101826]/95 px-2 py-1.5 shadow-2xl backdrop-blur">
                  {reactionOptions.map((reaction) => {
                    const isActive = post.reactionByMe === reaction.type;
                    return (
                      <button
                        key={reaction.type}
                        type="button"
                        onClick={() => onReact(isActive ? null : reaction.type)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                          isActive ? 'bg-white/12' : 'hover:bg-white/8'
                        }`}
                        aria-label={reaction.label}
                      >
                        <img src={reaction.image} alt={reaction.label} className="h-6 w-6" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onComments}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-primary transition-all duration-200 hover:bg-white/10 active:scale-95"
            >
              <MessageCircle size={18} />
            </button>

            <button
              type="button"
              onClick={onShare}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-primary transition-all duration-200 hover:bg-white/10 active:scale-95"
              aria-label={copy.share}
            >
              <Send size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={onSave}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${
              isSaved
                ? 'bg-accent text-black shadow-glow'
                : 'bg-white/5 text-text-primary hover:bg-white/10'
            }`}
            aria-label={isSaved ? copy.saved : copy.save}
          >
            <Bookmark size={18} className={isSaved ? 'fill-current' : ''} />
          </button>
        </div>

        <div className="text-sm font-medium text-text-primary">{meta}</div>
        <div className="text-xs text-text-tertiary">
          {formatCount(post.views)} views
        </div>
      </div>
    </article>
  );
}
