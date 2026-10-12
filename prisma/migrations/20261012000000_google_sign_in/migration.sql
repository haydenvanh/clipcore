-- Google sign-in: users are matched to their Google account by email.
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "image" TEXT;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
