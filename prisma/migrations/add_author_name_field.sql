-- Add authorName field to BlogPost table
ALTER TABLE "BlogPost" ADD COLUMN "authorName" TEXT;

-- Update existing posts to use admin user's name or default
UPDATE "BlogPost" 
SET "authorName" = COALESCE(
  (SELECT "name" FROM "User" WHERE "User"."id" = "BlogPost"."authorId"),
  'Admin'
) 
WHERE "authorName" IS NULL;