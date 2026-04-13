export type PostCategory = 'Training' | 'Nutrition' | 'Recovery' | 'Mindset';

export type FeedCategory = 'All' | 'Women' | PostCategory;

export type FeedTab = 'For You' | 'Following' | 'Latest';

export type ReactionType = 'love' | 'fire' | 'power' | 'wow';

export type ReactionCounts = Record<ReactionType, number>;

export type FeedCursor = {
  cursorCreatedAt: string;
  cursorId: number;
};

export type Post = {
  id: number;
  userId: number;
  authorName: string;
  authorGender: string;
  womenOnly: boolean;
  avatarUrl: string;
  latestCommentAvatarUrl: string;
  verified: boolean;
  caption: string;
  description: string;
  category: PostCategory;
  mediaType: 'image' | 'video';
  mediaThumbnail: string;
  mediaFull: string;
  mediaUrl: string;
  mediaAlt: string;
  mediaAspectRatio: string;
  createdAt: string | null;
  likedByMe: boolean;
  reactionByMe: ReactionType | null;
  views: number;
  likes: number;
  reactions: ReactionCounts;
  comments: number;
};

export type BlogComment = {
  id: number;
  postId: number;
  userId: number;
  authorName: string;
  avatarUrl: string;
  text: string;
  createdAt: string | null;
};

export type ShareDestination = 'whatsapp' | 'facebook' | 'messages' | 'instagram' | 'copy';

export type ReactionOption = {
  type: ReactionType;
  label: string;
  image: string;
};
