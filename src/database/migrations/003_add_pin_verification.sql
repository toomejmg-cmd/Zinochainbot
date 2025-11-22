-- Add PIN verification columns to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS pin_encrypted TEXT,
ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN DEFAULT FALSE;

-- Create index for PIN lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_pin_enabled ON user_settings(user_id) WHERE pin_enabled = TRUE;
