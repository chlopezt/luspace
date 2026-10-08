-- Keep the exact callback bound to each one-use OAuth flow during domain transition.
ALTER TABLE oauth_google_estados ADD COLUMN redirect_uri TEXT;

