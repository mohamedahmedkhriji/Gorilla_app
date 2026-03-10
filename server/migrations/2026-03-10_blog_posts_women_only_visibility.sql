USE gorella_fitness;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS women_only TINYINT(1) NOT NULL DEFAULT 0
  AFTER media_alt;

ALTER TABLE blog_posts
  ADD INDEX IF NOT EXISTS idx_blog_posts_women_only_created (women_only, created_at);
