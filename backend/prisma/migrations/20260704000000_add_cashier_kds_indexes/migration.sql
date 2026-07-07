-- Speed up cashier overview and KDS active order lookups.
CREATE INDEX IF NOT EXISTS "TableSession_status_lockedAt_idx"
ON "TableSession"("status", "lockedAt");

CREATE INDEX IF NOT EXISTS "OrderItem_sessionId_status_idx"
ON "OrderItem"("sessionId", "status");
