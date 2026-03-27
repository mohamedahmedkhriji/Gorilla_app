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
import { CoachmarkOverlay, type CoachmarkStep } from '../components/coachmarks/CoachmarkOverlay';
import { Header } from '../components/ui/Header';
import { getStoredAppUser, getStoredUserId } from '../shared/authStorage';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';
import { offlineCacheKeys, readOfflineCacheValue } from '../services/offlineCache';
import {
  BLOGS_COACHMARK_TOUR_ID,
  BLOGS_COACHMARK_VERSION,
  getCoachmarkUserScope,
  patchCoachmarkProgress,
  readCoachmarkProgress,
} from '../services/coachmarks';
import { playMediaSafely } from '../shared/mediaPlayback';

type PostCategory = 'Training' | 'Nutrition' | 'Recovery' | 'Mindset';
type FeedCategory = 'All' | 'Women' | PostCategory;
type ReactionType = 'love' | 'fire' | 'power' | 'wow';
type ReactionCounts = Record<ReactionType, number>;

type FeedCursor = {
  cursorCreatedAt: string;
  cursorId: number;
};

type Post = {
  id: number;
  userId: number;
  authorName: string;
  authorGender: string;
  womenOnly: boolean;
  avatarUrl: string;
  latestCommentAvatarUrl: string;
  verified: boolean;
  description: string;
  category: PostCategory;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mediaAlt: string;
  createdAt: string | null;
  likedByMe: boolean;
  reactionByMe: ReactionType | null;
  views: number;
  likes: number;
  reactions: ReactionCounts;
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
const FEED_PAGE_LIMIT = 20;
const DESCRIPTION_MAX_LENGTH = 5000;
const MEDIA_PAYLOAD_LIMIT = 8000000;

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

const BLOGS_I18N = {
  en: {
    refreshFeedAria: 'Refresh feed',
    createPostAria: 'Create new post',
    subtitle: 'Training, nutrition, recovery and mindset updates from the community.',
    categories: {
      All: 'All',
      Women: 'Women',
      Training: 'Training',
      Nutrition: 'Nutrition',
      Recovery: 'Recovery',
      Mindset: 'Mindset',
    },
    noPosts: 'No posts yet. Tap + to add your first post.',
    noCategoryPosts: (categoryLabel: string) => `No ${categoryLabel.toLowerCase()} posts in the loaded feed yet.`,
    showAllCategories: 'Show all categories',
    loading: 'Loading...',
    loadMore: 'Load more',
    loadingMorePosts: 'Loading more posts...',
    loadMorePosts: 'Load more posts',
    caughtUp: 'You are all caught up.',
    womenOnly: 'Women only',
    postOptions: 'Post options',
    deletePost: 'Delete post',
    hidePost: 'Hide post',
    deleteConfirm: 'Delete this post? This cannot be undone.',
    deleteTitle: 'Delete Post',
    deleteMessage: 'Are you sure you want to delete this post? This action cannot be undone.',
    deleteCancel: 'Cancel',
    deleteConfirmButton: 'Delete',
    sharePostAria: 'Share post',
    reactToPost: 'React to post',
    reactions: {
      love: 'Love it',
      fire: 'Fire',
      power: 'Power',
      wow: 'Wow',
    },
    shareTitle: 'Share Post',
    closeShare: 'Close share modal',
    shareEmpty: 'Choose where you want to share this post.',
    copyLink: 'Copy Link',
    linkCopied: 'Link copied.',
    linkCopiedInstagram: 'Link copied. Paste it into Instagram DM.',
    linkCopyFailed: 'Could not copy link automatically.',
    closeFullScreen: 'Close full screen posts',
    newPostTitle: 'New Post',
    newPostPlaceholder: 'Share your update...',
    womenOnlyLabel: 'Post for women only',
    womenOnlyHint: 'Only women will see this post in the blog feed.',
    uploadMedia: 'Upload image or video',
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
    errorLoadFeed: 'Failed to load blog feed',
    errorLoadMore: 'Failed to load more posts',
    errorUpdateLike: 'Failed to update reaction',
    errorLoadComments: 'Failed to load comments',
    errorPostComment: 'Failed to post comment',
    errorReadFile: 'Failed to read uploaded file.',
    errorFileTooLarge: 'Media file is too large.',
    errorDescriptionRequired: 'Write a short post description.',
    errorDescriptionTooLong: (max: number) => `Description is too long (max ${max} characters).`,
    errorMediaRequired: 'Upload an image or video.',
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
  },
  ar: {
    refreshFeedAria: 'تحديث الخلاصة',
    createPostAria: 'إنشاء منشور جديد',
    subtitle: 'تحديثات التدريب والتغذية والاستشفاء والعقلية من المجتمع.',
    categories: {
      All: 'الكل',
      Women: 'للنساء',
      Training: 'التدريب',
      Nutrition: 'التغذية',
      Recovery: 'الاستشفاء',
      Mindset: 'العقلية',
    },
    noPosts: 'لا توجد منشورات بعد. اضغط + لإضافة أول منشور لك.',
    noCategoryPosts: (categoryLabel: string) => `لا توجد منشورات ${categoryLabel} في الخلاصة المحمّلة حتى الآن.`,
    showAllCategories: 'عرض كل الفئات',
    loading: 'جارٍ التحميل...',
    loadMore: 'تحميل المزيد',
    loadingMorePosts: 'جارٍ تحميل المزيد من المنشورات...',
    loadMorePosts: 'تحميل المزيد من المنشورات',
    caughtUp: 'لا توجد منشورات جديدة.',
    womenOnly: 'للنساء فقط',
    postOptions: 'خيارات المنشور',
    deletePost: 'حذف المنشور',
    hidePost: 'إخفاء المنشور',
    deleteConfirm: 'هل تريد حذف هذا المنشور؟ لا يمكن التراجع.',
    deleteTitle: 'حذف المنشور',
    deleteMessage: 'هل أنت متأكد من حذف هذا المنشور؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteCancel: 'إلغاء',
    deleteConfirmButton: 'حذف',
    sharePostAria: 'مشاركة المنشور',
    reactToPost: 'التفاعل مع المنشور',
    reactions: {
      love: 'أعجبني',
      fire: 'ناري',
      power: 'قوة',
      wow: 'واو',
    },
    shareTitle: 'مشاركة المنشور',
    closeShare: 'إغلاق نافذة المشاركة',
    shareEmpty: 'اختر المكان الذي تريد مشاركة المنشور فيه.',
    copyLink: 'نسخ الرابط',
    linkCopied: 'تم نسخ الرابط.',
    linkCopiedInstagram: 'تم نسخ الرابط. الصقه في رسائل إنستغرام.',
    linkCopyFailed: 'تعذر نسخ الرابط تلقائيًا.',
    closeFullScreen: 'إغلاق العرض الكامل للمنشورات',
    newPostTitle: 'منشور جديد',
    newPostPlaceholder: 'شارك تحديثك...',
    womenOnlyLabel: 'منشور للنساء فقط',
    womenOnlyHint: 'لن يرى هذا المنشور إلا النساء في خلاصة المدونة.',
    uploadMedia: 'رفع صورة أو فيديو',
    newPostPreviewAlt: 'معاينة المنشور الجديد',
    publishing: 'جارٍ النشر...',
    publish: 'نشر المنشور',
    commentsTitle: 'التعليقات',
    existingComments: (count: number) => `التعليقات الحالية: ${count}`,
    loadingComments: 'جارٍ تحميل التعليقات...',
    noComments: 'لا توجد تعليقات بعد. أضف تعليقًا بالأسفل.',
    addCommentPlaceholder: 'أضف تعليقًا...',
    postComment: 'إرسال التعليق',
    postedRecently: 'نُشر مؤخرًا',
    postedRecentlyShort: 'مؤخرًا',
    postedJustNow: 'نُشر الآن',
    postedJustNowShort: 'الآن',
    postedMinutes: (value: number) => `نُشر قبل ${value} دقيقة`,
    postedMinutesShort: (value: number) => `قبل ${value} دقيقة`,
    postedHours: (value: number) => `نُشر قبل ${value} ساعة`,
    postedHoursShort: (value: number) => `قبل ${value} ساعة`,
    postedDays: (value: number) => `نُشر قبل ${value} يومًا`,
    postedDaysShort: (value: number) => `قبل ${value} يومًا`,
    shareDefaultDescription: 'اطّلع على هذا المنشور في RepSet.',
    shareCopiedFeedback: 'تم نسخ الرابط.',
    shareCopiedInstagramFeedback: 'تم نسخ الرابط. الصقه في رسائل إنستغرام.',
    shareCopyFailedFeedback: 'تعذر نسخ الرابط تلقائيًا.',
    errorDeletePost: 'تعذر حذف المنشور',
    errorMissingUser: 'معرّف المستخدم غير موجود. يرجى تسجيل الدخول مرة أخرى.',
    errorLoadFeed: 'تعذر تحميل خلاصة المدونة',
    errorLoadMore: 'تعذر تحميل المزيد من المنشورات',
    errorUpdateLike: 'تعذر تحديث التفاعل',
    errorLoadComments: 'تعذر تحميل التعليقات',
    errorPostComment: 'تعذر نشر التعليق',
    errorReadFile: 'تعذر قراءة الملف المرفوع.',
    errorFileTooLarge: 'حجم الملف كبير جدًا.',
    errorDescriptionRequired: 'اكتب وصفًا قصيرًا للمنشور.',
    errorDescriptionTooLong: (max: number) => `الوصف طويل جدًا (الحد الأقصى ${max} حرفًا).`,
    errorMediaRequired: 'ارفع صورة أو فيديو.',
    errorPublish: 'تعذر نشر المنشور',
    errorCopyLink: 'فشل نسخ الرابط إلى الحافظة',
    commentRequired: 'اكتب تعليقًا قبل الإرسال.',
    mediaAlt: 'وسائط المنشور',
    mediaAltUserUpload: 'وسائط مرفوعة من المستخدم',
    fallbackUser: 'مستخدم',
    avatarAlt: (name: string) => `الصورة الرمزية لـ ${name}`,
    uploadTitle: 'جارٍ إنشاء المنشور',
    uploadMessage: 'يرجى الانتظار لحظة...',
    maxTwoCategories: 'اختر حتى فئتين',
  },
  it: {
    refreshFeedAria: 'Aggiorna feed',
    createPostAria: 'Crea nuovo post',
    subtitle: 'Aggiornamenti su allenamento, nutrizione, recupero e mindset dalla community.',
    categories: {
      All: 'Tutti',
      Women: 'Donne',
      Training: 'Allenamento',
      Nutrition: 'Nutrizione',
      Recovery: 'Recupero',
      Mindset: 'Mentalita',
    },
    noPosts: 'Nessun post ancora. Tocca + per aggiungere il tuo primo post.',
    noCategoryPosts: (categoryLabel: string) => `Nessun post ${categoryLabel.toLowerCase()} nel feed caricato finora.`,
    showAllCategories: 'Mostra tutte le categorie',
    loading: 'Caricamento...',
    loadMore: 'Carica altro',
    loadingMorePosts: 'Caricamento di altri post...',
    loadMorePosts: 'Carica altri post',
    caughtUp: 'Hai visto tutto.',
    womenOnly: 'Solo donne',
    postOptions: 'Opzioni post',
    deletePost: 'Elimina post',
    hidePost: 'Nascondi post',
    deleteConfirm: 'Eliminare questo post? Questa azione non puo essere annullata.',
    deleteTitle: 'Elimina Post',
    deleteMessage: 'Sei sicuro di voler eliminare questo post? Questa azione non puo essere annullata.',
    deleteCancel: 'Annulla',
    deleteConfirmButton: 'Elimina',
    sharePostAria: 'Condividi post',
    reactToPost: 'Reagisci al post',
    reactions: {
      love: 'Lo adoro',
      fire: 'Fuoco',
      power: 'Potenza',
      wow: 'Wow',
    },
    shareTitle: 'Condividi Post',
    closeShare: 'Chiudi finestra condivisione',
    shareEmpty: 'Scegli dove vuoi condividere questo post.',
    copyLink: 'Copia Link',
    linkCopied: 'Link copiato.',
    linkCopiedInstagram: 'Link copiato. Incollalo nei DM di Instagram.',
    linkCopyFailed: 'Impossibile copiare automaticamente il link.',
    closeFullScreen: 'Chiudi post a schermo intero',
    newPostTitle: 'Nuovo Post',
    newPostPlaceholder: 'Condividi il tuo aggiornamento...',
    womenOnlyLabel: 'Post solo per donne',
    womenOnlyHint: 'Solo le donne vedranno questo post nel feed blog.',
    uploadMedia: 'Carica immagine o video',
    newPostPreviewAlt: 'Anteprima nuovo post',
    publishing: 'Pubblicazione...',
    publish: 'Pubblica Post',
    commentsTitle: 'Commenti',
    existingComments: (count: number) => `Commenti esistenti: ${count}`,
    loadingComments: 'Caricamento commenti...',
    noComments: 'Nessun commento ancora. Aggiungine uno qui sotto.',
    addCommentPlaceholder: 'Aggiungi un commento...',
    postComment: 'Pubblica Commento',
    postedRecently: 'Pubblicato di recente',
    postedRecentlyShort: 'recente',
    postedJustNow: 'Pubblicato ora',
    postedJustNowShort: 'ora',
    postedMinutes: (value: number) => `Pubblicato ${value}m fa`,
    postedMinutesShort: (value: number) => `${value}m fa`,
    postedHours: (value: number) => `Pubblicato ${value}h fa`,
    postedHoursShort: (value: number) => `${value}h fa`,
    postedDays: (value: number) => `Pubblicato ${value}g fa`,
    postedDaysShort: (value: number) => `${value}g fa`,
    shareDefaultDescription: 'Guarda questo post su RepSet.',
    shareCopiedFeedback: 'Link copiato.',
    shareCopiedInstagramFeedback: 'Link copiato. Incollalo nei DM di Instagram.',
    shareCopyFailedFeedback: 'Impossibile copiare automaticamente il link.',
    errorDeletePost: 'Impossibile eliminare il post',
    errorMissingUser: 'ID utente mancante. Effettua di nuovo l accesso.',
    errorLoadFeed: 'Impossibile caricare il feed blog',
    errorLoadMore: 'Impossibile caricare altri post',
    errorUpdateLike: 'Impossibile aggiornare la reazione',
    errorLoadComments: 'Impossibile caricare i commenti',
    errorPostComment: 'Impossibile pubblicare il commento',
    errorReadFile: 'Impossibile leggere il file caricato.',
    errorFileTooLarge: 'Il file multimediale e troppo grande.',
    errorDescriptionRequired: 'Scrivi una breve descrizione del post.',
    errorDescriptionTooLong: (max: number) => `La descrizione e troppo lunga (max ${max} caratteri).`,
    errorMediaRequired: 'Carica un immagine o un video.',
    errorPublish: 'Impossibile pubblicare il post',
    errorCopyLink: 'Copia negli appunti non riuscita',
    commentRequired: 'Scrivi un commento prima di pubblicarlo.',
    mediaAlt: 'Media del post',
    mediaAltUserUpload: 'Media caricati dall utente',
    fallbackUser: 'Utente',
    avatarAlt: (name: string) => `Avatar di ${name}`,
    uploadTitle: 'Creazione Post',
    uploadMessage: 'Attendi un momento...',
    maxTwoCategories: 'Scegli fino a 2 categorie',
  },
  de: {
    refreshFeedAria: 'Feed aktualisieren',
    createPostAria: 'Neuen Post erstellen',
    subtitle: 'Updates zu Training, Ernaehrung, Regeneration und Mindset aus der Community.',
    categories: {
      All: 'Alle',
      Women: 'Frauen',
      Training: 'Training',
      Nutrition: 'Ernaehrung',
      Recovery: 'Regeneration',
      Mindset: 'Mindset',
    },
    noPosts: 'Noch keine Posts. Tippe auf +, um deinen ersten Post hinzuzufuegen.',
    noCategoryPosts: (categoryLabel: string) => `Noch keine ${categoryLabel.toLowerCase()}-Posts im geladenen Feed.`,
    showAllCategories: 'Alle Kategorien anzeigen',
    loading: 'Laedt...',
    loadMore: 'Mehr laden',
    loadingMorePosts: 'Weitere Posts werden geladen...',
    loadMorePosts: 'Mehr Posts laden',
    caughtUp: 'Du bist auf dem neuesten Stand.',
    womenOnly: 'Nur fuer Frauen',
    postOptions: 'Post-Optionen',
    deletePost: 'Post loeschen',
    hidePost: 'Post ausblenden',
    deleteConfirm: 'Diesen Post loeschen? Das kann nicht rueckgaengig gemacht werden.',
    deleteTitle: 'Post Loeschen',
    deleteMessage: 'Moechtest du diesen Post wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.',
    deleteCancel: 'Abbrechen',
    deleteConfirmButton: 'Loeschen',
    sharePostAria: 'Post teilen',
    reactToPost: 'Auf Post reagieren',
    reactions: {
      love: 'Liebe ich',
      fire: 'Feuer',
      power: 'Power',
      wow: 'Wow',
    },
    shareTitle: 'Post Teilen',
    closeShare: 'Teilen-Fenster schliessen',
    shareEmpty: 'Waehle aus, wo du diesen Post teilen moechtest.',
    copyLink: 'Link Kopieren',
    linkCopied: 'Link kopiert.',
    linkCopiedInstagram: 'Link kopiert. Fuege ihn in Instagram-DMs ein.',
    linkCopyFailed: 'Link konnte nicht automatisch kopiert werden.',
    closeFullScreen: 'Vollbild-Posts schliessen',
    newPostTitle: 'Neuer Post',
    newPostPlaceholder: 'Teile dein Update...',
    womenOnlyLabel: 'Post nur fuer Frauen',
    womenOnlyHint: 'Nur Frauen sehen diesen Post im Blog-Feed.',
    uploadMedia: 'Bild oder Video hochladen',
    newPostPreviewAlt: 'Vorschau neuer Post',
    publishing: 'Wird veroeffentlicht...',
    publish: 'Post Veroeffentlichen',
    commentsTitle: 'Kommentare',
    existingComments: (count: number) => `Vorhandene Kommentare: ${count}`,
    loadingComments: 'Kommentare werden geladen...',
    noComments: 'Noch keine Kommentare. Fuege unten einen hinzu.',
    addCommentPlaceholder: 'Kommentar hinzufuegen...',
    postComment: 'Kommentar Senden',
    postedRecently: 'Vor kurzem gepostet',
    postedRecentlyShort: 'kuerzlich',
    postedJustNow: 'Gerade gepostet',
    postedJustNowShort: 'gerade',
    postedMinutes: (value: number) => `Vor ${value} Min gepostet`,
    postedMinutesShort: (value: number) => `vor ${value} Min`,
    postedHours: (value: number) => `Vor ${value} Std gepostet`,
    postedHoursShort: (value: number) => `vor ${value} Std`,
    postedDays: (value: number) => `Vor ${value} T gepostet`,
    postedDaysShort: (value: number) => `vor ${value} T`,
    shareDefaultDescription: 'Schau dir diesen Post auf RepSet an.',
    shareCopiedFeedback: 'Link kopiert.',
    shareCopiedInstagramFeedback: 'Link kopiert. Fuege ihn in Instagram-DMs ein.',
    shareCopyFailedFeedback: 'Link konnte nicht automatisch kopiert werden.',
    errorDeletePost: 'Post konnte nicht geloescht werden',
    errorMissingUser: 'Angemeldete Nutzer-ID fehlt. Bitte melde dich erneut an.',
    errorLoadFeed: 'Blog-Feed konnte nicht geladen werden',
    errorLoadMore: 'Weitere Posts konnten nicht geladen werden',
    errorUpdateLike: 'Reaktion konnte nicht aktualisiert werden',
    errorLoadComments: 'Kommentare konnten nicht geladen werden',
    errorPostComment: 'Kommentar konnte nicht gesendet werden',
    errorReadFile: 'Hochgeladene Datei konnte nicht gelesen werden.',
    errorFileTooLarge: 'Die Mediendatei ist zu gross.',
    errorDescriptionRequired: 'Schreibe eine kurze Post-Beschreibung.',
    errorDescriptionTooLong: (max: number) => `Beschreibung ist zu lang (max ${max} Zeichen).`,
    errorMediaRequired: 'Lade ein Bild oder Video hoch.',
    errorPublish: 'Post konnte nicht veroeffentlicht werden',
    errorCopyLink: 'Kopieren in die Zwischenablage fehlgeschlagen',
    commentRequired: 'Schreibe einen Kommentar, bevor du ihn sendest.',
    mediaAlt: 'Post-Medien',
    mediaAltUserUpload: 'Vom Nutzer hochgeladene Medien',
    fallbackUser: 'Nutzer',
    avatarAlt: (name: string) => `${name} Avatar`,
    uploadTitle: 'Post Wird Erstellt',
    uploadMessage: 'Bitte einen Moment warten...',
    maxTwoCategories: 'Waehle bis zu 2 Kategorien',
  },
} as const;

type BlogCopy = typeof BLOGS_I18N.en;

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
  typeof document !== 'undefined'
  && steps.every((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

const normalizeReactionType = (value: unknown): ReactionType | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'love' || normalized === 'fire' || normalized === 'power' || normalized === 'wow') {
    return normalized as ReactionType;
  }
  return null;
};

const mapPost = (raw: Record<string, unknown>): Post => ({
  id: Number(raw.id || 0),
  userId: Number(raw.userId || 0),
  authorName: String(raw.authorName || ''),
  authorGender: String(raw.authorGender || ''),
  womenOnly: Boolean(raw.womenOnly),
  avatarUrl: String(raw.avatarUrl || ''),
  latestCommentAvatarUrl: String(raw.latestCommentAvatarUrl || ''),
  verified: true,
  description: String(raw.description || ''),
  category: CATEGORY_OPTIONS.includes(raw.category as PostCategory) ? (raw.category as PostCategory) : 'Recovery',
  mediaType: raw.mediaType === 'video' ? 'video' : 'image',
  mediaUrl: String(raw.mediaUrl || ''),
  mediaAlt: typeof raw.mediaAlt === 'string' && raw.mediaAlt.trim() ? String(raw.mediaAlt) : '',
  createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
  reactionByMe: normalizeReactionType(raw.reactionByMe),
  likedByMe: Boolean(raw.likedByMe) || normalizeReactionType(raw.reactionByMe) !== null,
  views: toCount((raw.metrics as Record<string, unknown> | undefined)?.views),
  likes: toCount((raw.metrics as Record<string, unknown> | undefined)?.reactionsTotal)
    || toCount((raw.metrics as Record<string, unknown> | undefined)?.likes),
  reactions: (() => {
    const reactions = (raw.metrics as Record<string, unknown> | undefined)?.reactions as Record<string, unknown> | undefined;
    return {
      love: toCount(reactions?.love),
      fire: toCount(reactions?.fire),
      power: toCount(reactions?.power),
      wow: toCount(reactions?.wow),
    };
  })(),
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
  return getStoredUserId();
};

const getUserProfileImage = () => {
  const user = getStoredAppUser();
  return String(user?.profile_picture || user?.profile_photo || '').trim();
};

const getUserGender = () => {
  const user = getStoredAppUser();
  return String(user?.gender || '').trim().toLowerCase();
};

const isFemaleGender = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'female' || normalized === 'woman' || normalized === 'femme';
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

export function Blogs({
  guidedTourActive = false,
  onGuidedTourComplete,
  onGuidedTourDismiss,
}: BlogsProps) {
  const userId = useMemo(() => getUserId(), []);
  const userProfileImage = useMemo(() => getUserProfileImage(), []);
  const [userGender, setUserGender] = useState(() => getUserGender());
  const showWomenFilter = isFemaleGender(userGender);
  const canCreateWomenOnlyPost = showWomenFilter;
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = BLOGS_I18N[language] || BLOGS_I18N.en;
  const isArabic = language === 'ar';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<FeedCategory>('All');
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);
  const [isCoachmarkOpen, setIsCoachmarkOpen] = useState(false);

  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const reelsContainerRef = useRef<HTMLDivElement | null>(null);
  const reelVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const viewedPostIdsRef = useRef<Set<number>>(new Set());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<PostCategory[]>(['Recovery']);
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newWomenOnly, setNewWomenOnly] = useState(false);
  const [createError, setCreateError] = useState('');

  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, BlogComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyToComment, setReplyToComment] = useState<{ id: number; name: string } | null>(null);
  const [commentError, setCommentError] = useState('');
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const [openPostMenuId, setOpenPostMenuId] = useState<number | null>(null);
  const [openReactionPostId, setOpenReactionPostId] = useState<number | null>(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<number | null>(null);
  const [activeSharePostId, setActiveSharePostId] = useState<number | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const coachmarkScope = useMemo(() => getCoachmarkUserScope(getStoredAppUser()), []);
  const coachmarkOptions = useMemo(
    () => ({
      tourId: BLOGS_COACHMARK_TOUR_ID,
      version: BLOGS_COACHMARK_VERSION,
      userScope: coachmarkScope,
      defaultSeenSteps: {
        create: false,
        intro: false,
        filters: false,
        first_post: false,
      },
    }),
    [coachmarkScope],
  );

  const getCategoryLabel = useCallback(
    (category: FeedCategory) => copy.categories[category] || String(category),
    [copy],
  );
  const getAuthorName = useCallback(
    (name: string) => name || copy.fallbackUser,
    [copy],
  );
  const reactionOptions = useMemo(
    () => ([
      { type: 'love' as ReactionType, label: copy.reactions.love, image: REACTION_ASSETS.love },
      { type: 'fire' as ReactionType, label: copy.reactions.fire, image: REACTION_ASSETS.fire },
      { type: 'power' as ReactionType, label: copy.reactions.power, image: REACTION_ASSETS.power },
      { type: 'wow' as ReactionType, label: copy.reactions.wow, image: REACTION_ASSETS.wow },
    ]),
    [copy.reactions.fire, copy.reactions.love, copy.reactions.power, copy.reactions.wow],
  );
  const primaryCategory = selectedCategories[0] || 'Recovery';
  const toggleCategorySelection = useCallback(
    (category: PostCategory) => {
      setSelectedCategories((prev) => {
        if (prev.includes(category)) {
          const next = prev.filter((item) => item !== category);
          return next.length ? next : [category];
        }
        if (prev.length >= 2) return prev;
        return [...prev, category];
      });
    },
    [],
  );

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
    if (activeCategory === 'Women') {
      return posts.filter((post) => isFemaleGender(post.authorGender));
    }
    return posts.filter((post) => post.category === activeCategory);
  }, [activeCategory, posts]);
  const coachmarkCopy = useMemo(
    () => ({
      next: isArabic ? 'التالي' : 'Next',
      skip: isArabic ? 'تخطي' : 'Skip',
      finish: isArabic ? 'حسنًا' : 'Got it',
      steps: [
        {
          id: 'create',
          targetId: 'blogs_create_button',
          title: isArabic ? 'أنشئ منشورًا جديدًا' : 'Create a new post',
          body: isArabic
            ? 'هذا الزر في أعلى الصفحة لرفع منشور جديد في المدونات.'
            : 'Use this top button to create a new blog post.',
          placement: 'bottom' as const,
          shape: 'circle' as const,
          padding: 8,
        },
        {
          id: 'intro',
          targetId: 'blogs_page_intro',
          title: isArabic ? 'هذه صفحة المدونات' : 'This is the blogs page',
          body: isArabic
            ? 'هنا ترى تحديثات المجتمع عن التدريب والتغذية والاستشفاء.'
            : 'This page shows community updates about training, nutrition, and recovery.',
          placement: 'bottom' as const,
          shape: 'rounded' as const,
          padding: 8,
          cornerRadius: 16,
        },
        {
          id: 'filters',
          targetId: 'blogs_category_filters',
          title: isArabic ? 'غيّر الفئة من هنا' : 'Filter the feed here',
          body: isArabic
            ? 'يمكنك تغيير الفئة من هنا لرؤية نوع المنشورات الذي تريده.'
            : 'Use these filters to switch between different post categories.',
          placement: 'bottom' as const,
          shape: 'rounded' as const,
          padding: 8,
          cornerRadius: 16,
        },
        {
          id: 'first_post',
          targetId: 'blogs_first_post_card',
          title: isArabic ? 'هذا مثال على المنشورات' : 'This is a feed post',
          body: isArabic
            ? 'هنا يمكنك فتح المنشور والتفاعل معه وقراءة التعليقات.'
            : 'Open a post here to view it, react to it, and read comments.',
          placement: 'top' as const,
          shape: 'rounded' as const,
          padding: 8,
          cornerRadius: 20,
        },
      ] satisfies CoachmarkStep[],
    }),
    [isArabic],
  );
  const coachmarkSteps = coachmarkCopy.steps;
  const activeCoachmarkStep = coachmarkSteps[coachmarkStepIndex] || null;

  const categoryCounts = useMemo(() => {
    const counts: Record<FeedCategory, number> = {
      All: posts.length,
      Women: 0,
      Training: 0,
      Nutrition: 0,
      Recovery: 0,
      Mindset: 0,
    };

    posts.forEach((post) => {
      if (isFemaleGender(post.authorGender)) counts.Women += 1;
      counts[post.category] += 1;
    });

    return counts;
  }, [posts]);

  const categoryFilters = useMemo<FeedCategory[]>(
    () => (showWomenFilter ? ['All', 'Women', ...CATEGORY_OPTIONS] : ['All', ...CATEGORY_OPTIONS]),
    [showWomenFilter],
  );

  useEffect(() => {
    const loadViewerGender = async () => {
      if (!userId || userGender) return;
      try {
        const profile = await api.getProfileDetails(userId);
        setUserGender(String(profile?.gender || '').trim().toLowerCase());
      } catch {
        // Keep current session active even if viewer profile fetch fails.
      }
    };

    void loadViewerGender();
  }, [userGender, userId]);

  useEffect(() => {
    if (!showWomenFilter && activeCategory === 'Women') {
      setActiveCategory('All');
    }
  }, [activeCategory, showWomenFilter]);

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
    try {
      await api.deleteBlogPost(postId, userId);
      removePostFromView(postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorDeletePost);
    }
  }, [copy.errorDeletePost, removePostFromView, userId]);

  const confirmDeletePost = useCallback(async () => {
    if (!pendingDeletePostId) return;
    const postId = pendingDeletePostId;
    setPendingDeletePostId(null);
    await deleteOwnPost(postId);
  }, [deleteOwnPost, pendingDeletePostId]);

  const loadFeedChunk = useCallback(async (cursor: FeedCursor | null) => {
    if (!userId) {
      throw new Error(copy.errorMissingUser);
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
  }, [copy.errorMissingUser, readHiddenPostIds, userId]);

  const loadInitialFeed = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!userId) {
      setError(copy.errorMissingUser);
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
      setError(err instanceof Error ? err.message : copy.errorLoadFeed);
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, [copy.errorLoadFeed, copy.errorMissingUser, loadFeedChunk, userId]);

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
      setError(err instanceof Error ? err.message : copy.errorLoadMore);
    } finally {
      setLoadingMore(false);
    }
  }, [copy.errorLoadMore, hasMore, loadFeedChunk, loadingMore, nextCursor, userId]);

  useEffect(() => {
    if (!userId) return;

    const cachedFeed = readOfflineCacheValue<any>(
      offlineCacheKeys.blogsFeed(userId, { limit: FEED_PAGE_LIMIT }),
    );
    if (!cachedFeed) return;

    const hiddenIds = readHiddenPostIds();
    const nextPosts = Array.isArray(cachedFeed?.posts)
      ? cachedFeed.posts.map(mapPost).filter((post: Post) => !hiddenIds.has(post.id))
      : [];
    const parsedCursor = parseFeedCursor(cachedFeed?.nextCursor);

    setPosts(nextPosts);
    setNextCursor(parsedCursor);
    setHasMore(Boolean(cachedFeed?.hasMore) && Boolean(parsedCursor));
    setError('');
    setLoading(false);
  }, [readHiddenPostIds, userId]);

  useEffect(() => {
    void loadInitialFeed('initial');
  }, [loadInitialFeed]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-post-menu-root="true"]')) return;
      if (target?.closest('[data-reaction-menu-root="true"]')) return;
      setOpenPostMenuId(null);
      setOpenReactionPostId(null);
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

  const setReaction = async (postId: number, reactionType: ReactionType | null) => {
    if (!userId) return;

    try {
      const response = await api.setBlogReaction(postId, { userId, reactionType });
      const nextReaction = normalizeReactionType(response?.reactionType);
      const reactions = response?.reactions as Record<string, unknown> | undefined;
      const reactionsTotal = toCount(response?.reactionsTotal ?? response?.likesCount);

      setPosts((prev) => prev.map((post) => (
        post.id === postId
          ? {
              ...post,
              reactionByMe: nextReaction,
              likedByMe: Boolean(nextReaction),
              likes: reactionsTotal,
              reactions: {
                love: toCount(reactions?.love),
                fire: toCount(reactions?.fire),
                power: toCount(reactions?.power),
                wow: toCount(reactions?.wow),
              },
            }
          : post
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorUpdateLike);
    }
  };

  const handleDoubleLike = (postId: number) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.reactionByMe) return;
    void setReaction(postId, 'love');
  };

  const loadComments = useCallback(async (postId: number) => {
    setCommentsLoading(true);
    setCommentError('');
    try {
      const response = await api.getBlogComments(postId, 200);
      const comments = Array.isArray(response?.comments) ? response.comments.map(mapComment) : [];
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
      const latestCommentAvatarUrl = getLatestCommentAvatarUrl(comments);
      setPosts((prev) => prev.map((post) => (
        post.id === postId
          ? { ...post, comments: comments.length, latestCommentAvatarUrl }
          : post
      )));
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : copy.errorLoadComments);
    } finally {
      setCommentsLoading(false);
    }
  }, [copy.errorLoadComments]);

  const openComments = (postId: number) => {
    setActiveCommentsPostId(postId);
    setNewCommentText('');
    setCommentError('');
    setReplyToComment(null);
    void loadComments(postId);
  };

  const getSharePayload = useCallback((post: Post) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/blogs?post=${post.id}`;
    const cleanedDescription = post.description.replace(/\s+/g, ' ').trim();
    const summary = cleanedDescription
      ? cleanedDescription.slice(0, 120).trim() + (cleanedDescription.length > 120 ? '...' : '')
      : copy.shareDefaultDescription;
    const shareText = `${getAuthorName(post.authorName)}: ${summary}`;
    return { shareUrl, shareText };
  }, [copy.shareDefaultDescription, getAuthorName]);

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
      throw new Error(copy.errorCopyLink);
    }
  }, [copy.errorCopyLink]);

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
      setShareFeedback(destination === 'instagram' ? copy.shareCopiedInstagramFeedback : copy.shareCopiedFeedback);
    } catch {
      setShareFeedback(copy.shareCopyFailedFeedback);
    }
  }, [activeSharePostId, copy.shareCopiedFeedback, copy.shareCopiedInstagramFeedback, copy.shareCopyFailedFeedback, copyToClipboard, getSharePayload, posts]);

  const addComment = async () => {
    if (!activeCommentsPostId || !userId) return;
    const text = newCommentText.trim();
    const replyPrefix = replyToComment ? `@${replyToComment.name}` : '';
    const isReplyOnly = replyPrefix && text === replyPrefix;
    if (!text || isReplyOnly) {
      setCommentError(copy.commentRequired);
      return;
    }

    try {
      const finalText = replyPrefix && !text.startsWith(replyPrefix)
        ? `${replyPrefix} ${text}`
        : text;
      const response = await api.addBlogComment(activeCommentsPostId, { userId, text: finalText });
      const comment = response?.comment ? mapComment(response.comment) : null;
      const commentsCount = toCount(response?.commentsCount);
      const nextComments = comment
        ? [...(commentsByPost[activeCommentsPostId] || []), comment]
        : commentsByPost[activeCommentsPostId] || [];
      const latestCommentAvatarUrl = getLatestCommentAvatarUrl(nextComments);

      if (comment) {
        setCommentsByPost((prev) => ({
          ...prev,
          [activeCommentsPostId]: nextComments,
        }));
      }

      setPosts((prev) =>
        prev.map((post) => (
          post.id === activeCommentsPostId
            ? { ...post, comments: commentsCount, latestCommentAvatarUrl }
            : post
        )),
      );
      setNewCommentText('');
      setReplyToComment(null);
      setCommentError('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : copy.errorPostComment);
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
        void playMediaSafely(video);
      } else {
        video.pause();
      }
    });
  }, [activeReelIndex, visiblePosts]);

  useEffect(() => {
    if (isCreateOpen || activeReelIndex != null || isCoachmarkOpen) return;

    const timer = window.setTimeout(() => {
      const progress = readCoachmarkProgress(coachmarkOptions);
      const canShowTour =
        guidedTourActive
        && !progress.completed
        && !progress.dismissed
        && hasCoachmarkTargets(coachmarkSteps);

      if (canShowTour) {
        setCoachmarkStepIndex(Math.min(progress.currentStep, coachmarkSteps.length - 1));
        setIsCoachmarkOpen(true);
      }
    }, 420);

    return () => window.clearTimeout(timer);
  }, [
    activeReelIndex,
    coachmarkOptions,
    coachmarkSteps,
    guidedTourActive,
    isCoachmarkOpen,
    isCreateOpen,
  ]);

  const closeCoachmarks = () => {
    setIsCoachmarkOpen(false);
    setCoachmarkStepIndex(0);
  };

  const handleCoachmarkNext = () => {
    if (!activeCoachmarkStep || coachmarkStepIndex >= coachmarkSteps.length - 1) return;

    patchCoachmarkProgress(coachmarkOptions, (current) => ({
      currentStep: coachmarkStepIndex + 1,
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    setCoachmarkStepIndex((current) => Math.min(current + 1, coachmarkSteps.length - 1));
  };

  const handleCoachmarkFinish = () => {
    if (!activeCoachmarkStep) return;

    patchCoachmarkProgress(coachmarkOptions, (current) => ({
      completed: true,
      dismissed: false,
      currentStep: Math.max(coachmarkSteps.length - 1, 0),
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    closeCoachmarks();
    if (guidedTourActive) onGuidedTourComplete?.();
  };

  const handleCoachmarkSkip = () => {
    patchCoachmarkProgress(coachmarkOptions, {
      dismissed: true,
      currentStep: coachmarkStepIndex,
    });
    closeCoachmarks();
    if (guidedTourActive) onGuidedTourDismiss?.();
  };

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      if (!dataUrl) {
        setCreateError(copy.errorReadFile);
        return;
      }
      if (dataUrl.length > MEDIA_PAYLOAD_LIMIT) {
        setCreateError(copy.errorFileTooLarge);
        return;
      }

      setNewMediaUrl(dataUrl);
      setNewMediaType(file.type.startsWith('video/') ? 'video' : 'image');
      setCreateError('');
    } catch {
      setCreateError(copy.errorReadFile);
    }
  };

  const publishPost = async () => {
    if (!userId) {
      setCreateError(copy.errorMissingUser);
      return;
    }

    const description = newDescription.trim();
    if (!description) {
      setCreateError(copy.errorDescriptionRequired);
      return;
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setCreateError(copy.errorDescriptionTooLong(DESCRIPTION_MAX_LENGTH));
      return;
    }
    if (!newMediaUrl) {
      setCreateError(copy.errorMediaRequired);
      return;
    }

    setIsPublishing(true);
    setCreateError('');

    try {
      const response = await api.createBlogPost({
        userId,
        description,
        category: primaryCategory,
        mediaType: newMediaType,
        mediaUrl: newMediaUrl,
        mediaAlt: copy.mediaAltUserUpload,
        womenOnly: canCreateWomenOnlyPost && newWomenOnly,
      });
      const created = response?.post ? mapPost(response.post) : null;
      if (created) {
        setPosts((prev) => [created, ...prev.filter((post) => post.id !== created.id)]);
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
      setCreateError(err instanceof Error ? err.message : copy.errorPublish);
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
  const resolveCommentAvatar = (comment: BlogComment) => {
    if (comment.userId === userId && userProfileImage) return userProfileImage;
    if (comment.avatarUrl) return comment.avatarUrl;
    return DEFAULT_AVATAR;
  };
  const getLatestCommentAvatarUrl = (comments: BlogComment[]) => {
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const avatar = String(resolveCommentAvatar(comments[index]) || '').trim();
      if (avatar && avatar !== DEFAULT_AVATAR) {
        return avatar;
      }
    }
    return '';
  };
  const canPublish = Boolean(newDescription.trim()) && Boolean(newMediaUrl) && !isPublishing;

  return (
    <div className="blogs-page flex-1 flex flex-col min-h-screen pb-24">
      <div className="mx-auto w-full max-w-4xl bg-transparent px-4 pb-6 pt-4 space-y-4 sm:px-6">
        <Header
          compact
          rightElement={(
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { void loadInitialFeed('refresh'); }}
                disabled={refreshing || loading}
                className="w-11 h-11 rounded-full border border-[#D9DDE7] bg-white text-[#111827] flex items-center justify-center hover:border-[#BAC2D4] transition-colors disabled:opacity-60"
                aria-label={copy.refreshFeedAria}
              >
                <RefreshCcw size={17} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button
                data-coachmark-target="blogs_create_button"
                type="button"
                onClick={() => {
                  setIsCreateOpen(true);
                  setCreateError('');
                }}
                className="w-11 h-11 rounded-full bg-accent text-black flex items-center justify-center shadow-glow hover:opacity-90 transition-opacity"
                aria-label={copy.createPostAria}
              >
                <Plus size={20} />
              </button>
            </div>
          )}
        />
        <p data-coachmark-target="blogs_page_intro" className="text-xs text-[#6B7280]">
          {copy.subtitle}
        </p>

        <div data-coachmark-target="blogs_category_filters" className="flex gap-2 overflow-x-auto pb-1">
          {categoryFilters.map((category) => {
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
                {getCategoryLabel(category)}
                <span className="ml-1.5 text-[11px] opacity-80">{formatCount(categoryCounts[category])}</span>
              </button>
            );
          })}
        </div>

        {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`blog-skeleton-${index}`}
                className="rounded-2xl border border-[#D9DDE7] bg-white p-4"
              >
                <div className="h-3.5 w-24 rounded-md bg-[#E5E7EB] animate-pulse" />
                <div className="mt-3 h-36 rounded-xl bg-[#E5E7EB] animate-pulse sm:h-44" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div data-coachmark-target="blogs_first_post_card" className="bg-white border border-[#D9DDE7] rounded-2xl p-4 text-sm text-[#6B7280]">
            <div>{copy.noPosts}</div>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div data-coachmark-target="blogs_first_post_card" className="bg-white border border-[#D9DDE7] rounded-2xl p-4 text-sm text-[#6B7280] space-y-3">
            <div>{copy.noCategoryPosts(getCategoryLabel(activeCategory))}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="rounded-lg border border-[#D9DDE7] px-3 py-1.5 text-xs text-[#111827] hover:border-[#BAC2D4]"
              >
                {copy.showAllCategories}
              </button>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => { void loadMoreFeed(); }}
                  disabled={loadingMore}
                  className="rounded-lg border border-[#D9DDE7] px-3 py-1.5 text-xs text-[#111827] hover:border-[#BAC2D4] disabled:opacity-60"
                >
                  {loadingMore ? copy.loading : copy.loadMore}
                </button>
              )}
            </div>
          </div>
        ) : (
          visiblePosts.map((post, index) => (
            <article
              key={post.id}
              data-coachmark-target={index === 0 ? 'blogs_first_post_card' : undefined}
              className="cursor-pointer overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white"
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('[data-no-open="true"]')) return;
                openReelAt(index);
              }}
              onDoubleClick={() => handleDoubleLike(post.id)}
            >
              <header className="flex min-w-0 items-center gap-3 px-3 pb-2 pt-3">
                <img
                  src={resolvePostAvatar(post)}
                  alt={copy.avatarAlt(getAuthorName(post.authorName))}
                  className="h-10 w-10 rounded-full border border-[#D9DDE7] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold leading-none text-[#111827]">{getAuthorName(post.authorName)}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7280]">
                    <span>{getPostedAgo(post.createdAt, copy, true)}</span>
                    {post.womenOnly && (
                      <span className="rounded-full bg-[#FCE7F3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#BE185D]">
                        {copy.womenOnly}
                      </span>
                    )}
                  </div>
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
                    aria-label={copy.postOptions}
                  >
                    <MoreHorizontal size={17} />
                  </button>

                  {openPostMenuId === post.id && (
                    <div className="absolute right-0 top-10 z-20 min-w-[140px] overflow-hidden rounded-xl border border-[#D9DDE7] bg-white shadow-xl">
                      {post.userId === userId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPostMenuId(null);
                            setPendingDeletePostId(post.id);
                          }}
                          className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          {copy.deletePost}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => hidePost(post.id)}
                          className="w-full px-3 py-2.5 text-left text-sm text-[#111827] hover:bg-[#F3F4F6]"
                        >
                          {copy.hidePost}
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
                className="group relative w-full cursor-pointer overflow-hidden bg-[#DCE1EE]"
                style={{ aspectRatio: '1 / 1' }}
              >
                {post.mediaType === 'video' ? (
                  <video
                    src={post.mediaUrl}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={post.mediaUrl}
                    alt={post.mediaAlt || copy.mediaAlt}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                    loading="lazy"
                  />
                )}
              </button>

              <footer className="px-3 pb-3 pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[#111827]">
                    <div className="relative" data-no-open="true" data-reaction-menu-root="true">
                      <div className="flex items-center gap-2 text-[15px]">
                        <button
                          type="button"
                          data-no-open="true"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenReactionPostId((prev) => (prev === post.id ? null : post.id));
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F3F4F6]"
                          aria-label={copy.reactToPost}
                        >
                          {post.reactionByMe ? (
                            <img
                              src={REACTION_ASSETS[post.reactionByMe]}
                              alt={copy.reactions[post.reactionByMe]}
                              className="h-[18px] w-[18px]"
                            />
                          ) : (
                            <Heart size={18} />
                          )}
                        </button>
                        <span className="font-semibold">{formatCount(post.likes)}</span>
                      </div>

                      {openReactionPostId === post.id && (
                        <div
                          className="absolute -top-14 left-0 z-20 flex items-center gap-1 rounded-full border border-[#D9DDE7] bg-white px-2 py-1 shadow-lg"
                          data-no-open="true"
                        >
                          {reactionOptions.map((reaction) => {
                            const isActive = post.reactionByMe === reaction.type;
                            return (
                              <button
                                key={reaction.type}
                                type="button"
                                data-no-open="true"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const nextReaction = isActive ? null : reaction.type;
                                  void setReaction(post.id, nextReaction);
                                  setOpenReactionPostId(null);
                                }}
                                className={`flex h-9 w-9 items-center justify-center rounded-full ${isActive ? 'bg-[#EEF1F7]' : 'hover:bg-[#F3F4F6]'}`}
                                aria-label={reaction.label}
                              >
                                <img src={reaction.image} alt={reaction.label} className="h-6 w-6" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      data-no-open="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        openComments(post.id);
                      }}
                      className="flex items-center gap-2 rounded-full px-1 py-0.5 hover:bg-[#F3F4F6]"
                    >
                      <MessageCircle size={18} />
                      <span className="font-semibold">{formatCount(post.comments)}</span>
                      {post.latestCommentAvatarUrl && (
                        <img
                          src={post.latestCommentAvatarUrl}
                          alt={copy.avatarAlt(copy.fallbackUser)}
                          className="h-7 w-7 rounded-full border border-white/10 object-cover"
                        />
                      )}
                    </button>
                    <div className="flex items-center gap-2 text-[15px]">
                      <Eye size={18} />
                      <span className="font-semibold">{formatCount(post.views)}</span>
                    </div>
                  </div>

                </div>

                {post.description.trim() && (
                  <div className="text-sm leading-5 text-[#111827]">
                    <span className="font-semibold">{getAuthorName(post.authorName)}</span>
                    <span className="ml-2">{renderDescription(post.description)}</span>
                  </div>
                )}
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
            {loadingMore ? copy.loadingMorePosts : copy.loadMorePosts}
          </button>
        )}

        {!loading && posts.length > 0 && visiblePosts.length > 0 && !hasMore && (
          <div className="py-2 text-center text-xs text-[#6B7280]">{copy.caughtUp}</div>
        )}
      </div>

      {isPublishing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[280px] rounded-2xl border border-white/10 bg-card px-5 py-4 text-center text-text-primary shadow-2xl">
            <div className="text-base font-semibold">{copy.uploadTitle}</div>
            <div className="mt-1 text-sm text-text-secondary">{copy.uploadMessage}</div>
            <div className="mt-4 flex justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-text-tertiary border-t-transparent" />
            </div>
          </div>
        </div>
      )}

      {pendingDeletePostId != null && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPendingDeletePostId(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border border-white/10 bg-card p-4 shadow-2xl ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-base font-semibold text-white">{copy.deleteTitle}</h3>
              <button
                type="button"
                onClick={() => setPendingDeletePostId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[#FFFFFF]"
              >
                <X size={16} className="text-[#FFFFFF]" />
              </button>
            </div>
            <p className="mt-2 text-sm text-text-secondary">{copy.deleteMessage}</p>
            <div className={`mt-4 flex gap-2 ${isArabic ? 'justify-start' : 'justify-end'}`}>
              <button
                type="button"
                onClick={() => setPendingDeletePostId(null)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary hover:border-accent/30 hover:text-text-primary"
              >
                {copy.deleteCancel}
              </button>
              <button
                type="button"
                onClick={() => { void confirmDeletePost(); }}
                className="rounded-lg bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
              >
                {copy.deleteConfirmButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeReelIndex != null && (
        <div className="fixed inset-0 z-[60] bg-black">
          <button
            type="button"
            onClick={() => setActiveReelIndex(null)}
            className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[95] h-12 w-12 rounded-full bg-black/80 border-2 border-[#FFFFFF] text-[#FFFFFF] shadow-[0_0_18px_rgba(0,0,0,0.55)] backdrop-blur-sm flex items-center justify-center hover:bg-black"
            aria-label={copy.closeFullScreen}
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
                        void playMediaSafely(video);
                      } else {
                        video.pause();
                      }
                    }}
                    className="h-full w-full object-contain cursor-pointer"
                  />
                ) : (
                  <img src={post.mediaUrl} alt={post.mediaAlt || copy.mediaAlt} className="h-full w-full object-contain" />
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 sm:px-6 pb-8 pt-16">
                  <div className="flex items-center gap-3">
                  <img
                    src={resolvePostAvatar(post)}
                    alt={copy.avatarAlt(getAuthorName(post.authorName))}
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-[#FFFFFF] truncate">{getAuthorName(post.authorName)}</h3>
                    </div>
                      <div className="text-xs text-[#FFFFFF]">{getPostedAgo(post.createdAt, copy)}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#FFFFFF]">{renderDescription(post.description, true)}</p>

                  <div className="mt-3 flex items-center gap-5 text-[#FFFFFF]">
                    <div className="inline-flex items-center gap-1.5 text-xs">
                      <Eye size={16} />
                      <span>{formatCount(post.views)}</span>
                    </div>
                    <div className="relative" data-no-open="true" data-reaction-menu-root="true">
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          data-no-open="true"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenReactionPostId((prev) => (prev === post.id ? null : post.id));
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
                          aria-label={copy.reactToPost}
                        >
                          {post.reactionByMe ? (
                            <img
                              src={REACTION_ASSETS[post.reactionByMe]}
                              alt={copy.reactions[post.reactionByMe]}
                              className="h-[16px] w-[16px]"
                            />
                          ) : (
                            <Heart size={16} />
                          )}
                        </button>
                        <span>{formatCount(post.likes)}</span>
                      </div>

                      {openReactionPostId === post.id && (
                        <div
                          className="absolute -top-14 left-0 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/80 px-2 py-1 shadow-lg backdrop-blur"
                          data-no-open="true"
                        >
                          {reactionOptions.map((reaction) => {
                            const isActive = post.reactionByMe === reaction.type;
                            return (
                              <button
                                key={reaction.type}
                                type="button"
                                data-no-open="true"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const nextReaction = isActive ? null : reaction.type;
                                  void setReaction(post.id, nextReaction);
                                  setOpenReactionPostId(null);
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}
                                aria-label={reaction.label}
                              >
                                <img src={reaction.image} alt={reaction.label} className="h-5 w-5" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
              <h3 className="text-base font-semibold text-[#111827]">{copy.shareTitle}</h3>
              <button
                type="button"
                onClick={closeShareModal}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#EEF1F7] hover:text-[#111827]"
                aria-label={copy.closeShare}
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-[#6B7280]">
              {activeSharePost.description.trim()
                ? `${activeSharePost.description.trim().slice(0, 90)}${activeSharePost.description.trim().length > 90 ? '...' : ''}`
                : copy.shareEmpty}
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
                <span className="text-[11px] font-medium leading-none">{copy.copyLink}</span>
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
            setNewWomenOnly(false);
          }}
        >
          <div
            className={`w-full max-w-md max-h-[85vh] overflow-y-auto bg-card rounded-2xl border border-white/10 p-4 ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`flex items-center justify-between mb-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-base font-semibold text-white">{copy.newPostTitle}</h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateError('');
                  setNewWomenOnly(false);
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
                placeholder={copy.newPostPlaceholder}
                rows={4}
                className={`w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-text-secondary focus:outline-none focus:border-accent/60 ${isArabic ? 'text-right' : 'text-left'}`}
              />
              <div className={`text-[11px] text-text-secondary ${isArabic ? 'text-left' : 'text-right'}`}>{newDescription.length}/{DESCRIPTION_MAX_LENGTH}</div>

              <div className="space-y-2">
                <div className={`text-[11px] text-text-secondary ${isArabic ? 'text-right' : 'text-left'}`}>{copy.maxTwoCategories}</div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((option) => {
                    const isSelected = selectedCategories.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleCategorySelection(option)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                          isSelected
                            ? 'border-accent/50 bg-accent/15 text-white'
                            : 'border-white/10 bg-background text-text-secondary hover:border-accent/40 hover:text-text-primary'
                        }`}
                      >
                        {copy.categories[option] || option}
                      </button>
                    );
                  })}
                </div>
              </div>

              {canCreateWomenOnlyPost && (
                <label className={`flex items-center gap-3 rounded-xl border border-white/10 bg-background px-3 py-3 text-sm text-white cursor-pointer ${isArabic ? 'flex-row-reverse text-right' : 'text-left'}`}>
                  <input
                    type="checkbox"
                    checked={newWomenOnly}
                    onChange={(event) => setNewWomenOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent text-accent focus:ring-accent/40"
                  />
                  <span className="flex-1">
                    {copy.womenOnlyLabel}
                    <span className="block text-[11px] text-text-secondary mt-0.5">
                      {copy.womenOnlyHint}
                    </span>
                  </span>
                </label>
              )}

              <label className={`flex items-center justify-center gap-2 w-full border border-dashed border-white/20 rounded-xl px-3 py-3 text-sm text-text-secondary cursor-pointer hover:border-accent/60 hover:text-white transition-colors ${isArabic ? 'flex-row-reverse' : ''}`}>
                <Upload size={16} />
                {copy.uploadMedia}
                <input type="file" accept="image/*,video/*" onChange={handleFilePicked} className="hidden" />
              </label>

              {newMediaUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
                  {newMediaType === 'video' ? (
                    <video src={newMediaUrl} controls className="w-full max-h-56 object-contain" />
                  ) : (
                    <img src={newMediaUrl} alt={copy.newPostPreviewAlt} className="w-full max-h-56 object-contain" />
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
                {isPublishing ? copy.publishing : copy.publish}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCommentsPost && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            setActiveCommentsPostId(null);
            setCommentError('');
            setReplyToComment(null);
          }}
        >
          <div
            className="w-full max-w-md sm:max-w-lg bg-[#111316] text-white rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col items-center px-4 pt-3">
              <div className="h-1 w-12 rounded-full bg-white/20" />
              <div className="mt-3 flex w-full items-center justify-between">
                <div className="w-8" />
                <h3 className="text-base font-semibold">{copy.commentsTitle}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCommentsPostId(null);
                    setCommentError('');
                    setReplyToComment(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 text-[#FFFFFF] flex items-center justify-center"
                >
                  <X size={16} className="text-[#FFFFFF]" />
                </button>
              </div>
            </div>

            <div className="px-4 pt-3 text-xs text-white/50">
              {copy.existingComments(formatCount(activeCommentsPost.comments))}
            </div>

            <div className="max-h-[45vh] overflow-y-auto px-4 pb-3 pt-3 space-y-4">
              {commentsLoading ? (
                <div className="text-sm text-white/60 bg-white/5 rounded-lg px-3 py-2">{copy.loadingComments}</div>
              ) : localComments.length === 0 ? (
                <div className="text-sm text-white/60 bg-white/5 rounded-lg px-3 py-2">{copy.noComments}</div>
              ) : (
                localComments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-3">
                    <img
                      src={resolveCommentAvatar(comment)}
                      alt={copy.avatarAlt(getAuthorName(comment.authorName))}
                      className="h-9 w-9 rounded-full object-cover border border-white/10"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{getAuthorName(comment.authorName)}</span>
                        <span className="text-[11px] text-white/50">{getPostedAgo(comment.createdAt, copy, true)}</span>
                      </div>
                      <div className="text-sm text-white/90 mt-1">{comment.text}</div>
                      <button
                        type="button"
                        className="mt-1 text-[11px] text-white/50 hover:text-white/70"
                        onClick={() => {
                          const name = getAuthorName(comment.authorName);
                          const prefix = `@${name}`;
                          setReplyToComment({ id: comment.id, name });
                          setNewCommentText((prev) => {
                            const trimmedPrev = prev.trim();
                            if (trimmedPrev.startsWith(prefix)) return prev;
                            return `${prefix} `;
                          });
                          requestAnimationFrame(() => {
                            commentInputRef.current?.focus();
                          });
                        }}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-white/10 px-4 py-3 space-y-2">
              {replyToComment && (
                <div className="flex items-center justify-between rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">
                  <span>Replying to {replyToComment.name}</span>
                  <button
                    type="button"
                    onClick={() => setReplyToComment(null)}
                    className="text-white/60 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <img
                  src={userProfileImage || DEFAULT_AVATAR}
                  alt={copy.avatarAlt(copy.fallbackUser)}
                  className="h-8 w-8 rounded-full object-cover border border-white/10"
                />
                <div className="flex-1 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <input
                    ref={commentInputRef}
                    value={newCommentText}
                    onChange={(event) => setNewCommentText(event.target.value)}
                    placeholder={copy.addCommentPlaceholder}
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => { void addComment(); }}
                    className="text-white/70 hover:text-white"
                    aria-label={copy.postComment}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>

              {commentError && <div className="text-sm text-red-300">{commentError}</div>}

              <div className="flex items-center justify-between text-lg text-white/70">
                {['❤️', '🙌', '🔥', '👏', '🥺', '😍', '😮', '😂'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="transition-transform hover:scale-110"
                    onClick={() => setNewCommentText((prev) => `${prev}${emoji}`)}
                    aria-label={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <CoachmarkOverlay
        isOpen={isCoachmarkOpen}
        step={activeCoachmarkStep}
        stepIndex={coachmarkStepIndex}
        totalSteps={coachmarkSteps.length}
        nextLabel={coachmarkCopy.next}
        finishLabel={coachmarkCopy.finish}
        skipLabel={coachmarkCopy.skip}
        onNext={handleCoachmarkNext}
        onFinish={handleCoachmarkFinish}
        onSkip={handleCoachmarkSkip}
        onTargetAction={null}
      />
    </div>
  );
}
