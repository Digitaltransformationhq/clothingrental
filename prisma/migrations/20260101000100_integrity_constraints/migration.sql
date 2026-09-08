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
