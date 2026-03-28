-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "profile" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inferenceIncludePriorAffiliations" BOOLEAN NOT NULL DEFAULT false;
