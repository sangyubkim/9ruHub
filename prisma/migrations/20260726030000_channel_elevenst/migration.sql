-- Additive: 11번가(ELEVENST) 채널 enum 값
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Channel' AND e.enumlabel = 'ELEVENST'
  ) THEN
    ALTER TYPE "Channel" ADD VALUE 'ELEVENST';
  END IF;
END $$;
