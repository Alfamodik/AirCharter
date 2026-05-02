CREATE TABLE refresh_tokens (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(128) NOT NULL,
    created_at_utc DATETIME NOT NULL,
    expires_at_utc DATETIME NOT NULL,
    revoked_at_utc DATETIME NULL,
    replaced_by_token_id INT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY token_hash (token_hash),
    KEY user_id (user_id),
    KEY replaced_by_token_id (replaced_by_token_id),

    CONSTRAINT refresh_tokens_ibfk_1
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT refresh_tokens_ibfk_2
        FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens (id)
);
