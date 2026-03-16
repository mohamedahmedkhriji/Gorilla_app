USE gorella_fitness;

CREATE TABLE IF NOT EXISTS blog_post_reactions (
  post_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  reaction_type ENUM('love', 'fire', 'power', 'wow') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (post_id, user_id),
  INDEX idx_blog_post_reactions_user_created (user_id, created_at),
  INDEX idx_blog_post_reactions_post_type (post_id, reaction_type),

  CONSTRAINT fk_blog_post_reactions_post
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_blog_post_reactions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
