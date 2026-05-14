-- CreateEnum
CREATE TYPE "CommunicationTone" AS ENUM ('WARM', 'PROFESSIONAL', 'CONCISE', 'FRIENDLY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "communicationTone" "CommunicationTone",
ADD COLUMN "onboardingCatchUpPresetApplied" BOOLEAN NOT NULL DEFAULT false;
