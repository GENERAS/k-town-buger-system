# K Town Burger — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path not explicitly matched is denied (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity & Anti-Spoofing**: All write operations require `request.auth != null && request.auth.token.email_verified == true`. Admin checks require either verified bootstrapped owner email (`generaskagiraneza@gmail.com`) or existence in `/admins/{uid}`. Staff checks require an active doc in `/staffUsers/{uid}`.
3. **PII Isolation**:
   - Customer profiles (`/customers/{customerId}`) contain phone numbers, emails, and notes; reads are strictly restricted to `customerId == request.auth.uid` or verified admin/staff.
   - Orders (`/orders/{orderId}`) contain delivery addresses and phone numbers; `get` is restricted to `existing().userId == request.auth.uid` or verified staff/admin; `list` enforces `resource.data.userId == request.auth.uid` or bootstrapped verified admin without `get()`/`exists()` inside `allow list`.
4. **Relational Integrity**:
   - Feedback entries (`/feedback/{feedbackId}`) can only be created by the owner of the referenced `/orders/{orderId}` (`exists()` + `get()` verification).
   - Orders on create must carry `userId == request.auth.uid`, `status == 'New order received'`, bounded `items` (`1..40`), bounded `statusHistory` (`1..20`), and server-enforced timestamps (`createdAt == request.time`, `updatedAt == request.time`).
5. **Terminal State Locking**: Completed or Cancelled orders cannot be mutated by non-admin clients (`!(existing().status in ['Completed', 'Cancelled'])`).
6. **Immutability & Strict Schemas**: `userId`, `customerId`, `createdAt`, and `orderNumber` cannot change on update. Every update uses action branches with `affectedKeys().hasOnly(...)` wrapped inside `isValid[Entity](incoming())`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Order Write**: Creating `/orders/ord-999` with `request.auth == null`.
2. **Identity Spoofing on Order Create**: Signed-in user `uid-A` creates `/orders/ord-999` with `userId: "uid-B"`.
3. **Email Spoofing Without Verification**: User with `email: "generaskagiraneza@gmail.com"` and `email_verified: false` attempts to write `/menu/m-1`.
4. **Shadow / Ghost Field Injection**: User creates `/orders/ord-999` including `"isAdminOverride": true` or `"discountPercent": 100`.
5. **Client-Forged Timestamp**: User creates `/orders/ord-999` with `createdAt` set to a past client date instead of `request.time`.
6. **Status Shortcutting on Create**: User creates `/orders/ord-999` with `status: "Completed"` or `paymentStatus: "Confirmed"` when `paymentMethod == "Pay on Delivery"`.
7. **PII Blanket Scrape (`list` orders)**: Customer `uid-A` queries `/orders` without filtering `where('userId', '==', 'uid-A')`.
8. **Cross-Customer PII Read (`get` customer)**: Customer `uid-A` attempts `getDoc('/customers/uid-B')`.
9. **Resource / ID Poisoning**: User attempts to write `/orders/` with a 500-character ID containing `/` or spaces, or a 10,000-character `customerName`.
10. **Terminal State Tampering**: Staff or customer attempts to revert an order whose status is already `'Completed'` back to `'Preparing food'`.
11. **Self-Assigned Admin Escalation**: Customer `uid-A` attempts to create `/admins/uid-A` or `/staffUsers/uid-A` with `role: "Owner"`.
12. **Orphaned Feedback Spoofing**: Customer `uid-A` attempts to submit `/feedback/fb-999` referencing `orderId: "nonexistent-order"` or an order owned by `uid-B`.
