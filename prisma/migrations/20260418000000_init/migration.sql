-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'free',
    "subscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedAd" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoredBrand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoredBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandGuidelines" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandVoice" TEXT,
    "missionStatement" TEXT,
    "demographics" TEXT[],
    "interests" TEXT[],
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "referenceImages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandGuidelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedBrand" (
    "id" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "adLibraryUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,
    "trackerId" TEXT,

    CONSTRAINT "TrackedBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAdsFound" INTEGER NOT NULL,
    "activeAdsCount" INTEGER NOT NULL,
    "totalReach" BIGINT NOT NULL,
    "avgReachPerAd" DOUBLE PRECISION NOT NULL,
    "estimatedSpendUsd" DOUBLE PRECISION NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "carouselCount" INTEGER NOT NULL DEFAULT 0,
    "videoPercentage" DOUBLE PRECISION NOT NULL,
    "imagePercentage" DOUBLE PRECISION NOT NULL,
    "carouselPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgAdAgeDays" DOUBLE PRECISION NOT NULL,
    "dominantGender" TEXT,
    "dominantGenderPct" DOUBLE PRECISION,
    "dominantAgeRange" TEXT,
    "dominantAgePct" DOUBLE PRECISION,
    "topCountry1Code" TEXT,
    "topCountry1Pct" DOUBLE PRECISION,
    "topCountry2Code" TEXT,
    "topCountry2Pct" DOUBLE PRECISION,
    "topCountry3Code" TEXT,
    "topCountry3Pct" DOUBLE PRECISION,
    "demographicsJson" JSONB,
    "spendByCountryJson" JSONB,
    "trackedBrandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BrandSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HookGroup" (
    "id" TEXT NOT NULL,
    "hookText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "totalReach" BIGINT NOT NULL,
    "avgReachPerAd" DOUBLE PRECISION NOT NULL,
    "adIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotId" TEXT NOT NULL,

    CONSTRAINT "HookGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkReport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BenchmarkReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkBrand" (
    "id" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "adLibraryUrl" TEXT NOT NULL,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAdsFound" INTEGER,
    "activeAdsCount" INTEGER,
    "totalReach" BIGINT,
    "avgReachPerAd" DOUBLE PRECISION,
    "estimatedSpendUsd" DOUBLE PRECISION,
    "videoPercentage" DOUBLE PRECISION,
    "imagePercentage" DOUBLE PRECISION,
    "carouselPercentage" DOUBLE PRECISION,
    "dominantGender" TEXT,
    "dominantAgeRange" TEXT,
    "demographicsJson" JSONB,
    "benchmarkId" TEXT NOT NULL,

    CONSTRAINT "BenchmarkBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdLibraryBrand" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "profilePicUrl" TEXT,
    "country" TEXT,
    "category" TEXT,
    "website" TEXT,
    "totalReach" BIGINT NOT NULL DEFAULT 0,
    "activeAdCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "ingestionStatus" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3),
    "requestNote" TEXT,
    "demographicsJson" JSONB,
    "demographicsUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdLibraryBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdLibraryAd" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "displayFormat" TEXT,
    "publisherPlatforms" TEXT[],
    "body" TEXT,
    "caption" TEXT,
    "title" TEXT,
    "linkDescription" TEXT,
    "linkUrl" TEXT,
    "ctaText" TEXT,
    "ctaType" TEXT,
    "snapshotUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "adDurationDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reachEstimate" INTEGER,
    "impressionsLower" INTEGER,
    "impressionsUpper" INTEGER,
    "spendLower" DOUBLE PRECISION,
    "spendUpper" DOUBLE PRECISION,
    "currency" TEXT,
    "bylines" TEXT,
    "targetingJson" JSONB,
    "ingestionJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdLibraryAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAsset" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "originalUrl" TEXT NOT NULL,
    "storedUrl" TEXT,
    "storedKey" TEXT,
    "thumbnailUrl" TEXT,
    "thumbnailKey" TEXT,
    "fileExtension" TEXT,
    "fileSizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "downloadStatus" TEXT NOT NULL DEFAULT 'pending',
    "downloadError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "adsFetched" INTEGER NOT NULL DEFAULT 0,
    "adsCreated" INTEGER NOT NULL DEFAULT 0,
    "adsUpdated" INTEGER NOT NULL DEFAULT 0,
    "assetsQueued" INTEGER NOT NULL DEFAULT 0,
    "assetsDownloaded" INTEGER NOT NULL DEFAULT 0,
    "assetsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorsJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SovSnapshot" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "activeAds" INTEGER NOT NULL DEFAULT 0,
    "totalReach" BIGINT NOT NULL DEFAULT 0,
    "estSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "carouselCount" INTEGER NOT NULL DEFAULT 0,
    "newAdsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SovSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAnalysis" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "headline" TEXT,
    "messagingAngle" TEXT,
    "visualStyle" TEXT,
    "colorPalette" TEXT[],
    "ctaStyle" TEXT,
    "targetAudience" TEXT,
    "emotionalTone" TEXT,
    "fullAnalysis" JSONB,
    "creativityScore" INTEGER,
    "clarityScore" INTEGER,
    "persuasionScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdClassification" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "visualFormat" TEXT NOT NULL,
    "hookTactic" TEXT NOT NULL,
    "messagingAngle" TEXT NOT NULL,
    "awarenessStage" TEXT NOT NULL,
    "creativeMechanic" TEXT NOT NULL,
    "offerType" TEXT NOT NULL,
    "intendedAudience" TEXT NOT NULL,
    "hookScore" INTEGER NOT NULL,
    "conceptCluster" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "classifiedBy" TEXT NOT NULL DEFAULT 'haiku-4.5',
    "classificationSource" TEXT NOT NULL DEFAULT 'text',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationJob" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "totalAds" INTEGER NOT NULL DEFAULT 0,
    "classifiedAds" INTEGER NOT NULL DEFAULT 0,
    "failedAds" INTEGER NOT NULL DEFAULT 0,
    "skippedAds" INTEGER NOT NULL DEFAULT 0,
    "anthropicBatchId" TEXT,
    "batchSubmittedAt" TIMESTAMP(3),
    "batchCompletedAt" TIMESTAMP(3),
    "estimatedCostUsd" DOUBLE PRECISION,
    "actualCostUsd" DOUBLE PRECISION,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCostLog" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "brandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCostLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdTemplate" (
    "id" TEXT NOT NULL,
    "category" TEXT,
    "brandId" TEXT,
    "sourceAdIds" TEXT[],
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "messagingAngle" TEXT NOT NULL,
    "visualStyle" TEXT NOT NULL,
    "primaryPillar" TEXT,
    "pillarDetails" JSONB,
    "headlineFormula" TEXT NOT NULL,
    "bodyFormula" TEXT NOT NULL,
    "ctaText" TEXT NOT NULL,
    "colorSuggestions" TEXT[],
    "imageryNotes" TEXT NOT NULL,
    "layoutNotes" TEXT NOT NULL,
    "formatRecommendation" TEXT,
    "platformNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pageUrl" TEXT,
    "pageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapUpvote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapUpvote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCreator" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "totalAds" INTEGER NOT NULL DEFAULT 0,
    "totalReach" INTEGER NOT NULL DEFAULT 0,
    "brandCount" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'possible',
    "score" INTEGER NOT NULL DEFAULT 0,
    "creatorType" TEXT NOT NULL DEFAULT 'unknown',
    "categories" TEXT[],
    "signals" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPartnership" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "adCount" INTEGER NOT NULL DEFAULT 0,
    "totalReach" INTEGER NOT NULL DEFAULT 0,
    "metaAdIds" TEXT[],
    "snapshotUrls" TEXT[],
    "mediaUrls" TEXT[],
    "mediaTypes" TEXT[],
    "adBodies" TEXT[],
    "adTitles" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorPartnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAnalysisCache" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "assetTypeScore" INTEGER NOT NULL DEFAULT 0,
    "visualFormatScore" INTEGER NOT NULL DEFAULT 0,
    "hookTacticScore" INTEGER NOT NULL DEFAULT 0,
    "messagingAngleScore" INTEGER NOT NULL DEFAULT 0,
    "awarenessStageScore" INTEGER NOT NULL DEFAULT 0,
    "creativeMechanicScore" INTEGER NOT NULL DEFAULT 0,
    "offerTypeScore" INTEGER NOT NULL DEFAULT 0,
    "intendedAudienceScore" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER NOT NULL,
    "andromedaScore" INTEGER NOT NULL,
    "avgRefreshRate" DOUBLE PRECISION NOT NULL,
    "stalePercentage" INTEGER NOT NULL,
    "hookQualityAvg" DOUBLE PRECISION NOT NULL,
    "uniqueConcepts" INTEGER NOT NULL,
    "uniqueCtas" INTEGER NOT NULL,
    "funnelAwareness" INTEGER NOT NULL,
    "funnelConsideration" INTEGER NOT NULL,
    "funnelConversion" INTEGER NOT NULL,
    "distributionJson" JSONB NOT NULL,
    "totalAdsAnalyzed" INTEGER NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandAnalysisCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandVoice" TEXT,
    "missionStatement" TEXT,
    "positioning" TEXT,
    "painPoints" TEXT[],
    "demographics" TEXT[],
    "interests" TEXT[],
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "referenceImages" JSONB,
    "enrichmentHash" TEXT,
    "enrichedAt" TIMESTAMP(3),
    "enrichmentSource" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCompetitor" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "adLibraryBrandId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManusTask" (
    "id" TEXT NOT NULL,
    "manusTaskId" TEXT NOT NULL,
    "brandProfileId" TEXT,
    "prompt" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'research',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resultText" TEXT,
    "resultJson" JSONB,
    "manusUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ManusTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "SavedAd_userId_createdAt_idx" ON "SavedAd"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAd_userId_adId_key" ON "SavedAd"("userId", "adId");

-- CreateIndex
CREATE INDEX "MonitoredBrand_userId_createdAt_idx" ON "MonitoredBrand"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredBrand_userId_brandId_key" ON "MonitoredBrand"("userId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandGuidelines_userId_key" ON "BrandGuidelines"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedBrand_ownerId_key" ON "TrackedBrand"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedBrand_trackerId_facebookPageId_key" ON "TrackedBrand"("trackerId", "facebookPageId");

-- CreateIndex
CREATE INDEX "BrandSnapshot_trackedBrandId_snapshotDate_idx" ON "BrandSnapshot"("trackedBrandId", "snapshotDate");

-- CreateIndex
CREATE INDEX "HookGroup_snapshotId_idx" ON "HookGroup"("snapshotId");

-- CreateIndex
CREATE INDEX "HookGroup_snapshotId_totalReach_idx" ON "HookGroup"("snapshotId", "totalReach");

-- CreateIndex
CREATE INDEX "BenchmarkBrand_benchmarkId_idx" ON "BenchmarkBrand"("benchmarkId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkBrand_benchmarkId_facebookPageId_key" ON "BenchmarkBrand"("benchmarkId", "facebookPageId");

-- CreateIndex
CREATE UNIQUE INDEX "AdLibraryBrand_pageId_key" ON "AdLibraryBrand"("pageId");

-- CreateIndex
CREATE INDEX "AdLibraryBrand_ingestionStatus_priority_idx" ON "AdLibraryBrand"("ingestionStatus", "priority");

-- CreateIndex
CREATE INDEX "AdLibraryBrand_category_idx" ON "AdLibraryBrand"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AdLibraryAd_adId_key" ON "AdLibraryAd"("adId");

-- CreateIndex
CREATE INDEX "AdLibraryAd_brandId_isActive_idx" ON "AdLibraryAd"("brandId", "isActive");

-- CreateIndex
CREATE INDEX "AdLibraryAd_brandId_startDate_idx" ON "AdLibraryAd"("brandId", "startDate");

-- CreateIndex
CREATE INDEX "AdLibraryAd_displayFormat_idx" ON "AdLibraryAd"("displayFormat");

-- CreateIndex
CREATE INDEX "AdAsset_adId_idx" ON "AdAsset"("adId");

-- CreateIndex
CREATE INDEX "AdAsset_downloadStatus_idx" ON "AdAsset"("downloadStatus");

-- CreateIndex
CREATE INDEX "IngestionJob_brandId_status_idx" ON "IngestionJob"("brandId", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_status_createdAt_idx" ON "IngestionJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SovSnapshot_weekStart_idx" ON "SovSnapshot"("weekStart");

-- CreateIndex
CREATE INDEX "SovSnapshot_brandId_weekStart_idx" ON "SovSnapshot"("brandId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "SovSnapshot_brandId_weekStart_key" ON "SovSnapshot"("brandId", "weekStart");

-- CreateIndex
CREATE INDEX "AdAnalysis_adId_idx" ON "AdAnalysis"("adId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAnalysis_adId_key" ON "AdAnalysis"("adId");

-- CreateIndex
CREATE UNIQUE INDEX "AdClassification_adId_key" ON "AdClassification"("adId");

-- CreateIndex
CREATE INDEX "AdClassification_assetType_idx" ON "AdClassification"("assetType");

-- CreateIndex
CREATE INDEX "AdClassification_visualFormat_idx" ON "AdClassification"("visualFormat");

-- CreateIndex
CREATE INDEX "AdClassification_hookTactic_idx" ON "AdClassification"("hookTactic");

-- CreateIndex
CREATE INDEX "AdClassification_messagingAngle_idx" ON "AdClassification"("messagingAngle");

-- CreateIndex
CREATE INDEX "AdClassification_awarenessStage_idx" ON "AdClassification"("awarenessStage");

-- CreateIndex
CREATE INDEX "AdClassification_creativeMechanic_idx" ON "AdClassification"("creativeMechanic");

-- CreateIndex
CREATE INDEX "AdClassification_offerType_idx" ON "AdClassification"("offerType");

-- CreateIndex
CREATE INDEX "AdClassification_adId_idx" ON "AdClassification"("adId");

-- CreateIndex
CREATE INDEX "ClassificationJob_brandId_status_idx" ON "ClassificationJob"("brandId", "status");

-- CreateIndex
CREATE INDEX "ClassificationJob_status_createdAt_idx" ON "ClassificationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClassificationJob_anthropicBatchId_idx" ON "ClassificationJob"("anthropicBatchId");

-- CreateIndex
CREATE INDEX "ApiCostLog_date_operation_idx" ON "ApiCostLog"("date", "operation");

-- CreateIndex
CREATE INDEX "ApiCostLog_date_idx" ON "ApiCostLog"("date");

-- CreateIndex
CREATE INDEX "AdTemplate_category_idx" ON "AdTemplate"("category");

-- CreateIndex
CREATE INDEX "RoadmapRequest_type_status_idx" ON "RoadmapRequest"("type", "status");

-- CreateIndex
CREATE INDEX "RoadmapRequest_upvoteCount_idx" ON "RoadmapRequest"("upvoteCount");

-- CreateIndex
CREATE INDEX "RoadmapUpvote_userId_idx" ON "RoadmapUpvote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapUpvote_requestId_userId_key" ON "RoadmapUpvote"("requestId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreator_pageId_key" ON "AdCreator"("pageId");

-- CreateIndex
CREATE INDEX "AdCreator_tier_idx" ON "AdCreator"("tier");

-- CreateIndex
CREATE INDEX "AdCreator_score_idx" ON "AdCreator"("score");

-- CreateIndex
CREATE INDEX "AdCreator_creatorType_idx" ON "AdCreator"("creatorType");

-- CreateIndex
CREATE INDEX "CreatorPartnership_brandId_idx" ON "CreatorPartnership"("brandId");

-- CreateIndex
CREATE INDEX "CreatorPartnership_creatorId_idx" ON "CreatorPartnership"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorPartnership_creatorId_brandId_key" ON "CreatorPartnership"("creatorId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAnalysisCache_brandId_key" ON "BrandAnalysisCache"("brandId");

-- CreateIndex
CREATE INDEX "BrandAnalysisCache_brandId_idx" ON "BrandAnalysisCache"("brandId");

-- CreateIndex
CREATE INDEX "BrandProfile_userId_idx" ON "BrandProfile"("userId");

-- CreateIndex
CREATE INDEX "BrandProfile_userId_isActive_idx" ON "BrandProfile"("userId", "isActive");

-- CreateIndex
CREATE INDEX "BrandCompetitor_profileId_idx" ON "BrandCompetitor"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCompetitor_profileId_adLibraryBrandId_key" ON "BrandCompetitor"("profileId", "adLibraryBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "ManusTask_manusTaskId_key" ON "ManusTask"("manusTaskId");

-- CreateIndex
CREATE INDEX "ManusTask_status_idx" ON "ManusTask"("status");

-- CreateIndex
CREATE INDEX "ManusTask_brandProfileId_idx" ON "ManusTask"("brandProfileId");

-- AddForeignKey
ALTER TABLE "SavedAd" ADD CONSTRAINT "SavedAd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAd" ADD CONSTRAINT "SavedAd_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdLibraryAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredBrand" ADD CONSTRAINT "MonitoredBrand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredBrand" ADD CONSTRAINT "MonitoredBrand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandGuidelines" ADD CONSTRAINT "BrandGuidelines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedBrand" ADD CONSTRAINT "TrackedBrand_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedBrand" ADD CONSTRAINT "TrackedBrand_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSnapshot" ADD CONSTRAINT "BrandSnapshot_trackedBrandId_fkey" FOREIGN KEY ("trackedBrandId") REFERENCES "TrackedBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSnapshot" ADD CONSTRAINT "BrandSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HookGroup" ADD CONSTRAINT "HookGroup_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "BrandSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkReport" ADD CONSTRAINT "BenchmarkReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkBrand" ADD CONSTRAINT "BenchmarkBrand_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "BenchmarkReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdLibraryAd" ADD CONSTRAINT "AdLibraryAd_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdLibraryAd" ADD CONSTRAINT "AdLibraryAd_ingestionJobId_fkey" FOREIGN KEY ("ingestionJobId") REFERENCES "IngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAsset" ADD CONSTRAINT "AdAsset_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdLibraryAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SovSnapshot" ADD CONSTRAINT "SovSnapshot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAnalysis" ADD CONSTRAINT "AdAnalysis_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdLibraryAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClassification" ADD CONSTRAINT "AdClassification_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdLibraryAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationJob" ADD CONSTRAINT "ClassificationJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdTemplate" ADD CONSTRAINT "AdTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapUpvote" ADD CONSTRAINT "RoadmapUpvote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RoadmapRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPartnership" ADD CONSTRAINT "CreatorPartnership_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "AdCreator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPartnership" ADD CONSTRAINT "CreatorPartnership_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAnalysisCache" ADD CONSTRAINT "BrandAnalysisCache_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitor" ADD CONSTRAINT "BrandCompetitor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitor" ADD CONSTRAINT "BrandCompetitor_adLibraryBrandId_fkey" FOREIGN KEY ("adLibraryBrandId") REFERENCES "AdLibraryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManusTask" ADD CONSTRAINT "ManusTask_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

