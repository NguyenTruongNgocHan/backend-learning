-- CreateEnum
CREATE TYPE "DMKind" AS ENUM ('ONE_TO_ONE', 'GROUP');

-- CreateEnum
CREATE TYPE "DMMsgKind" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateTable
CREATE TABLE "DMThread" (
    "id" TEXT NOT NULL,
    "kind" "DMKind" NOT NULL DEFAULT 'ONE_TO_ONE',
    "threadKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DMThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DMParticipant" (
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "lastReadId" TEXT,

    CONSTRAINT "DMParticipant_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateTable
CREATE TABLE "DMMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "kind" "DMMsgKind" NOT NULL DEFAULT 'TEXT',
    "attachments" JSONB,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DMMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DMThread_threadKey_key" ON "DMThread"("threadKey");

-- CreateIndex
CREATE INDEX "DMParticipant_userId_idx" ON "DMParticipant"("userId");

-- CreateIndex
CREATE INDEX "DMMessage_threadId_createdAt_idx" ON "DMMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "DMParticipant" ADD CONSTRAINT "DMParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DMThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DMMessage" ADD CONSTRAINT "DMMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DMThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
