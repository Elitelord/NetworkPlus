/*
  Warnings:

  - You are about to drop the column `contactId` on the `Interaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Interaction" DROP CONSTRAINT "Interaction_contactId_fkey";

-- AlterTable
ALTER TABLE "Interaction" DROP COLUMN "contactId";

-- CreateTable
CREATE TABLE "_ContactToInteraction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContactToInteraction_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ContactToInteraction_B_index" ON "_ContactToInteraction"("B");

-- AddForeignKey
ALTER TABLE "_ContactToInteraction" ADD CONSTRAINT "_ContactToInteraction_A_fkey" FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToInteraction" ADD CONSTRAINT "_ContactToInteraction_B_fkey" FOREIGN KEY ("B") REFERENCES "Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
