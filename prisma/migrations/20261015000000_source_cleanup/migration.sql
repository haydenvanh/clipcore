-- Originals are deleted after processing to save disk; clips are kept.
ALTER TABLE "Video" ADD COLUMN "sourceDeletedAt" TIMESTAMP(3);
