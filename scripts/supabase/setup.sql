-- ═══════════════════════════════════════════════════════════════════════════
-- Almirah — complete Supabase (PostgreSQL) setup.
--
-- Generated from prisma/migrations. Run this ONCE, in order, against a fresh
-- Supabase project — SQL Editor → New query → paste → Run.
--
-- Equivalent to `prisma migrate deploy`, and it records the same bookkeeping
-- rows in "_prisma_migrations", so a later `prisma migrate deploy` from CI
-- sees both migrations as already applied and does nothing.
--
-- Sections:
--   1. Schema, enums, tables, indexes, foreign keys   (20260101000000_init)
--   2. Integrity constraints                          (20260101000100_...)
--   3. Row Level Security lockdown                    (Supabase-specific)
--   4. Prisma migration bookkeeping
--
-- The whole file runs as one transaction: if any statement fails, nothing is
-- committed and you can fix and re-run from the top.
--
-- Running it a SECOND time on a database it already built fails at the first
-- statement, with:
--
--     ERROR: 42710: type "UserRole" already exists
--
-- That error means the objects are already there -- not that something is
-- broken. Run `verify.sql` (read-only) to see which it is: every row "ok"
-- means the database is ready and this file should not be run again, and
-- anything INCOMPLETE means a previous run committed part-way, in which case
-- `reset.sql` clears "public" so this file can run from clean.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Schema, enums, tables, indexes, foreign keys
-- ───────────────────────────────────────────────────────────────────────────

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "VerificationKind" AS ENUM ('EMAIL', 'PHONE', 'GOVERNMENT_ID', 'PAYOUT_ACCOUNT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AddressKind" AS ENUM ('HOME', 'WORK', 'PICKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "SizeSystem" AS ENUM ('ALPHA', 'NUMERIC_UK', 'NUMERIC_EU', 'NUMERIC_IN', 'FREE_SIZE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('WOMEN', 'MEN', 'UNISEX');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW_WITH_TAGS', 'LIKE_NEW', 'GENTLY_WORN', 'WELL_LOVED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FulfilmentMode" AS ENUM ('PICKUP', 'LOCAL_DELIVERY', 'SHIPPING');

-- CreateEnum
CREATE TYPE "BlockReason" AS ENUM ('OWNER_BLOCKED', 'MAINTENANCE', 'PERSONAL_USE', 'CLEANING');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('DRAFT', 'PAYMENT_PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED', 'ACTIVE', 'RETURN_REQUESTED', 'RETURNED', 'INSPECTION', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'RETURN_IN_TRANSIT', 'RETURNED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'STRIPE', 'SANDBOX');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('RENTER_CANCELLED', 'OWNER_DECLINED', 'OWNER_CANCELLED', 'ITEM_UNAVAILABLE', 'DEPOSIT_RELEASE', 'DISPUTE_RESOLUTION', 'GOODWILL');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('HELD', 'PARTIALLY_CAPTURED', 'CAPTURED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('RENTER_ON_ITEM', 'OWNER_ON_RENTER');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('RENTAL_REQUESTED', 'RENTAL_ACCEPTED', 'RENTAL_DECLINED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'RENTAL_REMINDER', 'RETURN_REMINDER', 'LISTING_APPROVED', 'LISTING_REJECTED', 'MESSAGE_RECEIVED', 'PAYOUT_PROCESSED', 'REVIEW_RECEIVED', 'DISPUTE_OPENED');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'LOST');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'RESOLVED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('RENTER_FAVOURED', 'OWNER_FAVOURED', 'SPLIT', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "ReportSubject" AS ENUM ('LISTING', 'USER', 'MESSAGE', 'REVIEW');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "bio" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "avatarKey" TEXT,
    "ratingAvgBps" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "rentalsHosted" INTEGER NOT NULL DEFAULT 0,
    "rentalsTaken" INTEGER NOT NULL DEFAULT 0,
    "responseRateBps" INTEGER NOT NULL DEFAULT 0,
    "responseMins" INTEGER,
    "isIdentityVerified" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "VerificationKind" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "documentKey" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AddressKind" NOT NULL DEFAULT 'HOME',
    "label" TEXT,
    "recipient" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "heroKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDesigner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "system" "SizeSystem" NOT NULL DEFAULT 'ALPHA',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Color" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occasion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "heroKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOccasion" (
    "itemId" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,

    CONSTRAINT "ItemOccasion_pkey" PRIMARY KEY ("itemId","occasionId")
);

-- CreateTable
CREATE TABLE "ClothingItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "brandId" TEXT,
    "categoryId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'WOMEN',
    "condition" "ItemCondition" NOT NULL DEFAULT 'LIKE_NEW',
    "retailPriceMinor" INTEGER,
    "fabric" TEXT,
    "careInstructions" TEXT,
    "bustMm" INTEGER,
    "waistMm" INTEGER,
    "hipMm" INTEGER,
    "lengthMm" INTEGER,
    "shoulderMm" INTEGER,
    "sleeveMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClothingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClothingImage" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "blurDataUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClothingImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "baseRateMinor" INTEGER NOT NULL,
    "baseDurationDays" INTEGER NOT NULL DEFAULT 3,
    "extraDayRateMinor" INTEGER NOT NULL,
    "depositMinor" INTEGER NOT NULL,
    "cleaningFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "minRentalDays" INTEGER NOT NULL DEFAULT 3,
    "maxRentalDays" INTEGER NOT NULL DEFAULT 14,
    "bufferDays" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 1,
    "instantBook" BOOLEAN NOT NULL DEFAULT false,
    "fulfilment" "FulfilmentMode"[],
    "deliveryFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "deliveryRadiusKm" INTEGER,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "rentalTerms" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "wishlistCount" INTEGER NOT NULL DEFAULT 0,
    "rentalCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAvgBps" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" "BlockReason" NOT NULL DEFAULT 'OWNER_BLOCKED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "standfirst" TEXT,
    "heroKey" TEXT,
    "curatorId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionListing" (
    "collectionId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionListing_pkey" PRIMARY KEY ("collectionId","listingId")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "rentalSubtotalMinor" INTEGER NOT NULL,
    "deliveryFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "serviceFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "depositMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "deliveryAddressId" TEXT,
    "fulfilment" "FulfilmentMode" NOT NULL DEFAULT 'SHIPPING',
    "renterNote" TEXT,
    "placedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalItem" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "bufferDays" INTEGER NOT NULL DEFAULT 1,
    "baseRateMinor" INTEGER NOT NULL,
    "baseDurationDays" INTEGER NOT NULL,
    "extraDayRateMinor" INTEGER NOT NULL,
    "cleaningFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "lineSubtotalMinor" INTEGER NOT NULL,
    "depositMinor" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "commissionMinor" INTEGER NOT NULL,
    "ownerEarningsMinor" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTransition" (
    "id" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "mode" "FulfilmentMode" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "handoverNote" TEXT,
    "outboundAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "providerOrderId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerSignature" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "amountMinor" INTEGER NOT NULL,
    "capturedMinor" INTEGER NOT NULL DEFAULT 0,
    "refundedMinor" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "providerRefundId" TEXT,
    "note" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityDeposit" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "capturedMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "DepositStatus" NOT NULL DEFAULT 'HELD',
    "releasedAt" TIMESTAMP(3),
    "captureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "bankLast4" TEXT NOT NULL,
    "ifscCode" TEXT,
    "upiHandle" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'SCHEDULED',
    "providerPayoutId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutItem" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformFee" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "serviceFeeBps" INTEGER NOT NULL,
    "taxBps" INTEGER NOT NULL DEFAULT 0,
    "minFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "listingId" TEXT,
    "authorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "direction" "ReviewDirection" NOT NULL,
    "rating" INTEGER NOT NULL,
    "fitRating" INTEGER,
    "conditionRating" INTEGER,
    "accuracyRating" INTEGER,
    "body" TEXT,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'APPROVED',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "rentalId" TEXT,
    "subject" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "systemEvent" TEXT,
    "rentalId" TEXT,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageReport" (
    "id" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "severity" "DamageSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceKeys" TEXT[],
    "claimedMinor" INTEGER NOT NULL,
    "approvedMinor" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DamageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "DisputeOutcome",
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "resolutionNote" TEXT,
    "settlementMinor" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "subject" "ReportSubject" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "actionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_handle_key" ON "Profile"("handle");

-- CreateIndex
CREATE INDEX "Profile_city_idx" ON "Profile"("city");

-- CreateIndex
CREATE INDEX "Profile_ratingAvgBps_idx" ON "Profile"("ratingAvgBps");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Account_providerId_idx" ON "Account"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "Verification"("expiresAt");

-- CreateIndex
CREATE INDEX "IdentityVerification_status_idx" ON "IdentityVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityVerification_userId_kind_key" ON "IdentityVerification"("userId", "kind");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_name_idx" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Size_slug_key" ON "Size"("slug");

-- CreateIndex
CREATE INDEX "Size_sortOrder_idx" ON "Size"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Color_slug_key" ON "Color"("slug");

-- CreateIndex
CREATE INDEX "Color_family_idx" ON "Color"("family");

-- CreateIndex
CREATE UNIQUE INDEX "Occasion_slug_key" ON "Occasion"("slug");

-- CreateIndex
CREATE INDEX "Occasion_sortOrder_idx" ON "Occasion"("sortOrder");

-- CreateIndex
CREATE INDEX "ItemOccasion_occasionId_idx" ON "ItemOccasion"("occasionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClothingItem_slug_key" ON "ClothingItem"("slug");

-- CreateIndex
CREATE INDEX "ClothingItem_ownerId_idx" ON "ClothingItem"("ownerId");

-- CreateIndex
CREATE INDEX "ClothingItem_categoryId_idx" ON "ClothingItem"("categoryId");

-- CreateIndex
CREATE INDEX "ClothingItem_brandId_idx" ON "ClothingItem"("brandId");

-- CreateIndex
CREATE INDEX "ClothingItem_sizeId_idx" ON "ClothingItem"("sizeId");

-- CreateIndex
CREATE INDEX "ClothingItem_colorId_idx" ON "ClothingItem"("colorId");

-- CreateIndex
CREATE INDEX "ClothingItem_gender_idx" ON "ClothingItem"("gender");

-- CreateIndex
CREATE INDEX "ClothingImage_itemId_position_idx" ON "ClothingImage"("itemId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_itemId_key" ON "Listing"("itemId");

-- CreateIndex
CREATE INDEX "Listing_status_moderation_idx" ON "Listing"("status", "moderation");

-- CreateIndex
CREATE INDEX "Listing_ownerId_idx" ON "Listing"("ownerId");

-- CreateIndex
CREATE INDEX "Listing_city_idx" ON "Listing"("city");

-- CreateIndex
CREATE INDEX "Listing_baseRateMinor_idx" ON "Listing"("baseRateMinor");

-- CreateIndex
CREATE INDEX "Listing_publishedAt_idx" ON "Listing"("publishedAt");

-- CreateIndex
CREATE INDEX "Listing_status_publishedAt_idx" ON "Listing"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Listing_ratingAvgBps_idx" ON "Listing"("ratingAvgBps");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_listingId_startDate_endDate_idx" ON "AvailabilityBlock"("listingId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_isFeatured_sortOrder_idx" ON "Collection"("isFeatured", "sortOrder");

-- CreateIndex
CREATE INDEX "CollectionListing_listingId_idx" ON "CollectionListing"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_reference_key" ON "Rental"("reference");

-- CreateIndex
CREATE INDEX "Rental_renterId_status_idx" ON "Rental"("renterId", "status");

-- CreateIndex
CREATE INDEX "Rental_status_idx" ON "Rental"("status");

-- CreateIndex
CREATE INDEX "Rental_createdAt_idx" ON "Rental"("createdAt");

-- CreateIndex
CREATE INDEX "RentalItem_listingId_startDate_endDate_idx" ON "RentalItem"("listingId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "RentalItem_listingId_status_idx" ON "RentalItem"("listingId", "status");

-- CreateIndex
CREATE INDEX "RentalItem_ownerId_status_idx" ON "RentalItem"("ownerId", "status");

-- CreateIndex
CREATE INDEX "RentalItem_rentalId_idx" ON "RentalItem"("rentalId");

-- CreateIndex
CREATE INDEX "RentalItem_status_idx" ON "RentalItem"("status");

-- CreateIndex
CREATE INDEX "BookingTransition_rentalItemId_createdAt_idx" ON "BookingTransition"("rentalItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_rentalItemId_key" ON "Delivery"("rentalItemId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Payment_rentalId_idx" ON "Payment"("rentalId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerOrderId_key" ON "Payment"("provider", "providerOrderId");

-- CreateIndex
CREATE INDEX "Refund_rentalId_idx" ON "Refund"("rentalId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDeposit_rentalId_key" ON "SecurityDeposit"("rentalId");

-- CreateIndex
CREATE INDEX "SecurityDeposit_status_idx" ON "SecurityDeposit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_userId_key" ON "PayoutAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_reference_key" ON "Payout"("reference");

-- CreateIndex
CREATE INDEX "Payout_ownerId_status_idx" ON "Payout"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutItem_rentalItemId_key" ON "PayoutItem"("rentalItemId");

-- CreateIndex
CREATE INDEX "PayoutItem_payoutId_idx" ON "PayoutItem"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFee_key_key" ON "PlatformFee"("key");

-- CreateIndex
CREATE INDEX "PlatformFee_isDefault_effectiveFrom_idx" ON "PlatformFee"("isDefault", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Review_listingId_moderation_idx" ON "Review"("listingId", "moderation");

-- CreateIndex
CREATE INDEX "Review_subjectId_idx" ON "Review"("subjectId");

-- CreateIndex
CREATE INDEX "Review_authorId_idx" ON "Review"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_rentalItemId_direction_key" ON "Review"("rentalItemId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_key" ON "Wishlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_shareToken_key" ON "Wishlist"("shareToken");

-- CreateIndex
CREATE INDEX "WishlistItem_listingId_idx" ON "WishlistItem"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_listingId_key" ON "WishlistItem"("wishlistId", "listingId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DamageReport_rentalItemId_key" ON "DamageReport"("rentalItemId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_rentalId_idx" ON "Dispute"("rentalId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_subject_subjectId_idx" ON "Report"("subject", "subjectId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOccasion" ADD CONSTRAINT "ItemOccasion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOccasion" ADD CONSTRAINT "ItemOccasion_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingImage" ADD CONSTRAINT "ClothingImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionListing" ADD CONSTRAINT "CollectionListing_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionListing" ADD CONSTRAINT "CollectionListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTransition" ADD CONSTRAINT "BookingTransition_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. Integrity constraints
-- ───────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- Integrity constraints that Prisma's schema language cannot express.
--
-- These are the invariants the application must never be able to violate, even
-- through a raw query, a bad migration or a future refactor. Application-level
-- validation exists as well; this layer is what makes the guarantee real.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Money is never negative ────────────────────────────────────────────────
-- Every monetary column is an integer in minor units. A negative amount always
-- indicates a calculation bug, and we would rather fail the transaction than
-- persist a corrupt ledger.

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_money_non_negative" CHECK (
    "baseRateMinor" >= 0
    AND "extraDayRateMinor" >= 0
    AND "depositMinor" >= 0
    AND "cleaningFeeMinor" >= 0
    AND "deliveryFeeMinor" >= 0
  );

-- A rental policy that cannot be satisfied would let a listing render a date
-- picker in which no selection is ever valid.
ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_rental_window_coherent" CHECK (
    "minRentalDays" >= 1
    AND "maxRentalDays" >= "minRentalDays"
    AND "baseDurationDays" >= 1
    AND "bufferDays" >= 0
    AND "leadTimeDays" >= 0
  );

ALTER TABLE "Rental"
  ADD CONSTRAINT "Rental_money_non_negative" CHECK (
    "rentalSubtotalMinor" >= 0
    AND "deliveryFeeMinor" >= 0
    AND "serviceFeeMinor" >= 0
    AND "taxMinor" >= 0
    AND "depositMinor" >= 0
    AND "discountMinor" >= 0
    AND "totalMinor" >= 0
  );

-- The order total must equal the sum of its parts. This is the single most
-- important invariant in the system: it is what makes a client-submitted total
-- structurally impossible to persist, because the server-computed components
-- have to add up.
ALTER TABLE "Rental"
  ADD CONSTRAINT "Rental_total_is_sum_of_parts" CHECK (
    "totalMinor" = "rentalSubtotalMinor"
                 + "deliveryFeeMinor"
                 + "serviceFeeMinor"
                 + "taxMinor"
                 + "depositMinor"
                 - "discountMinor"
  );

ALTER TABLE "RentalItem"
  ADD CONSTRAINT "RentalItem_money_non_negative" CHECK (
    "baseRateMinor" >= 0
    AND "extraDayRateMinor" >= 0
    AND "cleaningFeeMinor" >= 0
    AND "lineSubtotalMinor" >= 0
    AND "depositMinor" >= 0
    AND "commissionMinor" >= 0
    AND "ownerEarningsMinor" >= 0
  );

-- Commission plus earnings must reconstruct the line subtotal, so the
-- marketplace can never pay out more than it collected.
ALTER TABLE "RentalItem"
  ADD CONSTRAINT "RentalItem_split_reconciles" CHECK (
    "lineSubtotalMinor" = "commissionMinor" + "ownerEarningsMinor"
  );

ALTER TABLE "RentalItem"
  ADD CONSTRAINT "RentalItem_commission_bps_range" CHECK (
    "commissionBps" >= 0 AND "commissionBps" <= 10000
  );

-- ── Booking date ranges are well formed ────────────────────────────────────
-- Ranges are half-open [startDate, endDate). An end on or before the start
-- would produce a zero or negative duration and silently break every
-- availability query, which reasons about overlap.

ALTER TABLE "RentalItem"
  ADD CONSTRAINT "RentalItem_dates_ordered" CHECK ("endDate" > "startDate");

ALTER TABLE "RentalItem"
  ADD CONSTRAINT "RentalItem_days_matches_range" CHECK (
    "days" = ("endDate"::date - "startDate"::date)
  );

ALTER TABLE "RentalItem"
  ADD CONSTRAINT "RentalItem_buffer_non_negative" CHECK ("bufferDays" >= 0);

ALTER TABLE "AvailabilityBlock"
  ADD CONSTRAINT "AvailabilityBlock_dates_ordered" CHECK ("endDate" > "startDate");

-- ── Payments and refunds stay within their bounds ──────────────────────────

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amounts_within_bounds" CHECK (
    "amountMinor" >= 0
    AND "capturedMinor" >= 0
    AND "refundedMinor" >= 0
    AND "capturedMinor" <= "amountMinor"
    AND "refundedMinor" <= "capturedMinor"
  );

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_amount_positive" CHECK ("amountMinor" > 0);

ALTER TABLE "SecurityDeposit"
  ADD CONSTRAINT "SecurityDeposit_capture_within_hold" CHECK (
    "amountMinor" >= 0
    AND "capturedMinor" >= 0
    AND "capturedMinor" <= "amountMinor"
  );

ALTER TABLE "Payout"
  ADD CONSTRAINT "Payout_amount_positive" CHECK ("amountMinor" > 0);

ALTER TABLE "PayoutItem"
  ADD CONSTRAINT "PayoutItem_amount_non_negative" CHECK ("amountMinor" >= 0);

ALTER TABLE "PlatformFee"
  ADD CONSTRAINT "PlatformFee_bps_range" CHECK (
    "commissionBps" BETWEEN 0 AND 10000
    AND "serviceFeeBps" BETWEEN 0 AND 10000
    AND "taxBps" BETWEEN 0 AND 10000
  );

-- ── Reviews are whole stars, one to five ───────────────────────────────────

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_sub_ratings_range" CHECK (
    ("fitRating" IS NULL OR "fitRating" BETWEEN 1 AND 5)
    AND ("conditionRating" IS NULL OR "conditionRating" BETWEEN 1 AND 5)
    AND ("accuracyRating" IS NULL OR "accuracyRating" BETWEEN 1 AND 5)
  );

-- A member may not review themselves, in either direction.
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_author_is_not_subject" CHECK ("authorId" <> "subjectId");

-- ── Reputation aggregates stay coherent ────────────────────────────────────

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_reputation_range" CHECK (
    "ratingAvgBps" BETWEEN 0 AND 50000
    AND "ratingCount" >= 0
    AND "responseRateBps" BETWEEN 0 AND 10000
  );

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_rating_range" CHECK (
    "ratingAvgBps" BETWEEN 0 AND 50000 AND "ratingCount" >= 0
  );

-- ── An owner cannot rent from themselves ───────────────────────────────────
-- Enforced here as well as in the booking service, because self-renting would
-- let a member manufacture reviews and rental history.

CREATE OR REPLACE FUNCTION "almirah_reject_self_rental"() RETURNS trigger AS $$
DECLARE
  renter_id text;
BEGIN
  SELECT "renterId" INTO renter_id FROM "Rental" WHERE "id" = NEW."rentalId";
  IF renter_id = NEW."ownerId" THEN
    RAISE EXCEPTION 'A member cannot rent their own garment (owner % = renter %)',
      NEW."ownerId", renter_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentalItem_reject_self_rental"
  BEFORE INSERT OR UPDATE OF "ownerId", "rentalId" ON "RentalItem"
  FOR EACH ROW EXECUTE FUNCTION "almirah_reject_self_rental"();

-- ── Occupancy: no two live bookings of one garment may overlap ─────────────
--
-- The booking service already serialises writes per listing with a transaction
-- advisory lock and re-checks availability inside that lock. This trigger is
-- the backstop: it holds even for a raw INSERT, a bad migration, or a future
-- code path that forgets to take the lock.
--
-- `btree_gist` (and therefore an EXCLUDE constraint) is not available on every
-- PostgreSQL deployment this schema targets, so the same guarantee is
-- expressed as a trigger over core functionality only. The buffer window after
-- each booking is included: a garment must be back and cleaned before it goes
-- out again.

CREATE OR REPLACE FUNCTION "almirah_reject_overlapping_booking"() RETURNS trigger AS $$
DECLARE
  conflict_id text;
BEGIN
  -- Statuses that do not hold the garment: a declined, cancelled or completed
  -- booking frees its dates.
  IF NEW."status" IN ('DECLINED', 'CANCELLED', 'COMPLETED') THEN
    RETURN NEW;
  END IF;

  SELECT "id" INTO conflict_id
  FROM "RentalItem" existing
  WHERE existing."listingId" = NEW."listingId"
    AND existing."id" <> NEW."id"
    AND existing."status" NOT IN ('DECLINED', 'CANCELLED', 'COMPLETED')
    -- Half-open overlap, each range extended by its own turnaround buffer.
    AND existing."startDate" < (NEW."endDate" + make_interval(days => NEW."bufferDays"))
    AND NEW."startDate" < (existing."endDate" + make_interval(days => existing."bufferDays"))
  LIMIT 1;

  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Listing % is already booked over % to % (conflicting booking %)',
      NEW."listingId", NEW."startDate", NEW."endDate", conflict_id
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentalItem_reject_overlap"
  BEFORE INSERT OR UPDATE OF "startDate", "endDate", "status", "listingId", "bufferDays"
  ON "RentalItem"
  FOR EACH ROW EXECUTE FUNCTION "almirah_reject_overlapping_booking"();

-- ── A published listing must be approved ───────────────────────────────────
-- Moderation cannot be bypassed by flipping a status field.

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_published_requires_approval" CHECK (
    "status" <> 'PUBLISHED' OR "moderation" = 'APPROVED'
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Row Level Security lockdown  (Supabase-specific — not in the migrations)
--
-- Supabase publishes every table in "public" through PostgREST, reachable with
-- the anon key that ships in the browser bundle. This application does not use
-- PostgREST or Supabase Auth — it talks to PostgreSQL directly through Prisma
-- with its own session/authorisation layer (better-auth), so every one of these
-- tables must be closed to the REST API or the whole database is world-readable.
--
-- Enabling RLS with no policies denies everything. The "postgres" role that
-- Prisma connects as owns these tables and is therefore unaffected; only the
-- anon / authenticated REST roles are shut out.
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END
$$;

-- Future tables (a later `prisma migrate deploy`) must not be granted either.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Prisma migration bookkeeping
--
-- Without these rows `prisma migrate deploy` would try to apply both migrations
-- again and fail on the first CREATE TYPE. The checksums are the SHA-256 of the
-- migration files as committed; if you edit a migration, this file is stale.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"            VARCHAR(64) NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES
  (gen_random_uuid()::text,
   '7b8a7bda4cb2ab6c1769334a760c4d2ed68680415f2e2ca2650abf2e8b247d7f',
   now(), '20260101000000_init', now(), 1),
  (gen_random_uuid()::text,
   'c1daaa6d261905e6afb6c33d0cb41c4a0b2a12139708c6669cd8dfd940565771',
   now(), '20260101000100_integrity_constraints', now(), 1);

-- Created after the loop above, so it is locked down here.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "_prisma_migrations" FROM anon, authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done. Next: point DATABASE_URL at this project and run `npm run db:provision`
-- to load the catalogue taxonomy (categories, brands, sizes, colours,
-- occasions), which the app needs before a listing can be created.
--
-- Use `db:provision`, NOT `db:seed`. The seed builds a lived-in demo
-- marketplace and clears every table before it writes, and its accounts share
-- one published password. Its only guard is NODE_ENV=production, which is not
-- set on your machine -- so running it here would wipe this database without
-- complaint. `db:provision` upserts the taxonomy and the fee schedule, removes
-- no row, and is safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════
