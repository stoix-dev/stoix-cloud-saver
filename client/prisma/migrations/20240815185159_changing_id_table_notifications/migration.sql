/*
  Warnings:

  - The primary key for the `notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `notifications` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(36)`.

*/
-- AlterTable
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(36),
ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
