-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "readCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "templateVariables" TEXT,
ADD COLUMN     "totalRecipients" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CampaignContact" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ineligibleReason" TEXT,
ADD COLUMN     "snapshotEmail" TEXT,
ADD COLUMN     "snapshotFirstName" TEXT,
ADD COLUMN     "snapshotLastName" TEXT,
ADD COLUMN     "snapshotPhone" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "userId" INTEGER,
ADD COLUMN     "whatsappMediaId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "errorCategory" TEXT,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "bodyText" TEXT,
ADD COLUMN     "components" TEXT,
ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "headerContent" TEXT,
ADD COLUMN     "headerType" TEXT,
ADD COLUMN     "metaTemplateId" TEXT,
ADD COLUMN     "wabaId" TEXT;

-- AlterTable: Add userId to WhatsAppBusinessAccount (default to 0 for existing rows, then make NOT NULL)
ALTER TABLE "WhatsAppBusinessAccount" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WhatsAppPhoneNumber" ADD COLUMN     "messagingLimit" TEXT,
ADD COLUMN     "phoneNumberId" TEXT,
ADD COLUMN     "qualityRating" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContact_campaignId_contactId_key" ON "CampaignContact"("campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_language_key" ON "Template"("name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppPhoneNumber_phoneNumberId_key" ON "WhatsAppPhoneNumber"("phoneNumberId");

-- AddForeignKey
ALTER TABLE "WhatsAppBusinessAccount" ADD CONSTRAINT "WhatsAppBusinessAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
