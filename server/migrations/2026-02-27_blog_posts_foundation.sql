USE gorella_fitness;

CREATE TABLE IF NOT EXISTS blog_posts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  category ENUM('Training', 'Nutrition', 'Recovery', 'Mindset') NOT NULL DEFAULT 'Recovery',
  description TEXT NOT NULL,
  media_type ENUM('image', 'video') NOT NULL,
  media_url LONGTEXT NOT NULL,
  media_alt VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_blog_posts_user_created (user_id, created_at),
  INDEX idx_blog_posts_created (created_at),

  CONSTRAINT fk_blog_posts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blog_post_likes (
  post_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (post_id, user_id),
  INDEX idx_blog_post_likes_user_created (user_id, created_at),

  CONSTRAINT fk_blog_post_likes_post
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_blog_post_likes_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blog_post_views (
  post_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  view_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (post_id, user_id, view_date),
  INDEX idx_blog_post_views_user_created (user_id, created_at),

  CONSTRAINT fk_blog_post_views_post
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_blog_post_views_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blog_post_comments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_blog_post_comments_post_created (post_id, created_at),
  INDEX idx_blog_post_comments_user_created (user_id, created_at),

  CONSTRAINT fk_blog_post_comments_post
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_blog_post_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
