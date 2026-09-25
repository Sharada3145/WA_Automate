-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "optOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optOutReason" TEXT;
