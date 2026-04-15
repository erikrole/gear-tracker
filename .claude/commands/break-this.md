---
version: 1.0.0
rollback: git checkout HEAD -- .claude/commands/break-this.md
observe: echo "[break-this] run at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ~/.claude/logs/skill-runs.log
feedback: cat ~/.claude/logs/skill-feedback.log
---

# Break This

Single-pass reliability stress test. Adopt the mindset of a hostile user, a flaky
network, and a race condition — simultaneously. Find every way this target can fail,
then fix it.

**Target:** $ARGUMENTS

---

## Role

You are a chaos engineer and security-minded reliability specialist.
You do not trust the happy path. You do not trust the client. You do not trust
the network. You do not trust that two requests won't arrive simultaneously.

## GOAL

Find every way this target can fail, corrupt data, leak authorization, or confuse
the user. Fix every issue found. Prioritize by blast radius:
**data corruption > auth bypass > silent failure > bad UX.**

## PREPARATION (do this before breaking anything)

1. Read the target file completely
2. Read every API route the target calls — full file, including middleware and auth checks
   - List every mutation endpoint (POST/PUT/PATCH/DELETE) the target triggers
3. Read `prisma/schema.prisma` — understand the models, relations, cascade rules (`onDelete`),
   `@@unique` constraints, and required vs optional fields relevant to this target
4. Read `docs/DECISIONS.md` — especially D-001 (derived status), D-006 (SERIALIZABLE),
   D-012 (booking lifecycle guards)
5. Read relevant `docs/AREA_*.md` — understand intended behavior so you can distinguish
   bugs from intentional design
6. Read `tasks/lessons.md` — check for previously discovered failure patterns in this area
7. Grep for `$transaction` in the API routes — which mutations are atomic and which are not?
8. Grep for `AbortController` in the page — does fetch cancellation exist?

---

## ATTACK SURFACE 1: Data Integrity

### Database-Level Attacks
- [ ] **Lost updates**: Find any read-then-write pattern not wrapped in a transaction.
      Two users editing the same entity simultaneously — does one overwrite the other?
      Check for `findUnique` → logic → `update` sequences without `$transaction`.
- [ ] **Phantom reads**: Bulk operations (multi-item checkout, stock adjustments) that
      read counts, then write — can another request change the data between read and write?
- [ ] **Cascade landmines**: Delete an entity. Do its children cascade correctly?
      Does the cascade delete audit logs or allocation records that should be preserved?
- [ ] **Constraint violations**: Submit data that violates unique constraints (duplicate
      asset tags, overlapping allocations). Does the API return a clear error or crash
      with a Prisma P2002?
- [ ] **Enum boundary**: Send an invalid enum value (e.g., `status: "YOLO"`). Does
      Prisma reject it, or does it silently store garbage?

### State Machine Violations
- [ ] **Illegal transitions**: Can you move a booking from COMPLETED back to OPEN via
      direct API call? Check every status transition against D-012 lifecycle rules.
- [ ] **Double-complete**: Complete a checkout twice. Does it create duplicate audit
      entries? Does it double-credit returned items?
- [ ] **Cancel-after-complete**: Cancel a booking that's already completed. What happens
      to the allocations?

---

## ATTACK SURFACE 2: Authorization & RBAC

- [ ] **Vertical escalation**: Can a STUDENT hit an ADMIN-only endpoint by crafting the
      request directly? Check every API route for role guards.
- [ ] **Horizontal escalation**: Can User A modify User B's draft booking? Check that
      ownership is verified, not just authentication.
- [ ] **Role transition**: User is downgraded from STAFF to STUDENT mid-session.
      Do their open tabs still allow STAFF actions?
- [ ] **Auth expiry during mutation**: Session expires between page load and form submit.
      Does the mutation fail gracefully with redirect, or return a confusing 500?

---

## ATTACK SURFACE 3: Concurrency & Race Conditions

- [ ] **Double-submit**: Click the submit button twice in <100ms. Do two records get
      created? Two allocations? Two audit entries?
- [ ] **Concurrent checkout**: Two users check out the same serialized item simultaneously.
      Does one get an error, or do both succeed (violating D-001)?
- [ ] **Stale form data**: User A opens edit form. User B edits and saves the same record.
      User A saves their stale version. Whose data wins? Is there any conflict detection?
- [ ] **Parallel deletes**: Two admins delete the same item simultaneously. Does it
      error on the second, or silently succeed?
- [ ] **Race between fetch and mutation**: Page is loading data. User clicks a button
      that mutates. The mutation fires before the load completes. What state is the UI in?

---

## ATTACK SURFACE 4: Input & Payload

- [ ] **XSS vectors**: Enter `<script>alert('xss')</script>` in every text field.
      Does React's default escaping handle it, or are there `dangerouslySetInnerHTML` uses?
- [ ] **Null injection**: Send null for required fields. Send empty strings for fields
      that should reject them.
- [ ] **Boundary strings**: Send extremely long strings (10K+ chars). Does the UI truncate?
      Does the API reject? Does Prisma hit a column limit?
- [ ] **Malformed dates**: Send `"not-a-date"` for date fields. Send dates in the past
      for future-only fields. Send dates 100 years from now.
- [ ] **Negative numbers**: Quantity fields — can you check out -5 items? Set stock to -1?
- [ ] **Query parameter pollution**: Add unexpected query params. Send array where string
      is expected.

---

## ATTACK SURFACE 5: Network & Timing

- [ ] **Slow API (3s+ latency)**: Is there a loading indicator? Can the user interact
      with stale controls while loading? Can they navigate away and cause a zombie request?
- [ ] **API returns 500**: Does the error message help the user? Can they retry?
      Is the retry idempotent?
- [ ] **Partial failure in batch**: Multi-step operation where step 2 of 3 fails. Is the
      system left in a consistent state? Are step 1's effects rolled back?
- [ ] **Network drops mid-mutation**: POST succeeds on server but response never arrives.
      User retries. Is the operation idempotent?
- [ ] **Vercel function timeout**: Can any operation exceed the 10s hobby / 60s pro
      serverless timeout? Large imports, complex queries, multiple sequential DB calls?
- [ ] **Tab goes background for 30 minutes**: User returns — is data stale? Can they
      tell? Do they interact with stale data without realizing?

---

## REPORTING FORMAT

For each failure found, document:

```
### BRK-NNN: [Short title]
- **Surface**: Data Integrity / Auth / Concurrency / Input / Network
- **Risk**: CRITICAL (data loss/corruption) | HIGH (auth bypass, silent failure) | MEDIUM (bad UX, confusing error) | LOW (cosmetic)
- **Reproduction**: [Exact steps to trigger]
- **Current behavior**: [What happens now]
- **Expected behavior**: [What should happen]
- **Root cause**: [Technical explanation]
- **Fix**: [Description of implemented fix]
```

## FIX PRIORITY

1. **CRITICAL** — Fix immediately. Data integrity and auth issues are non-negotiable.
2. **HIGH** — Fix in the same pass. Silent failures and broken workflows.
3. **MEDIUM** — Fix if under 20 lines of code. Otherwise log to `tasks/todo.md`.
4. **LOW** — Log to `tasks/todo.md` only. Cosmetic issues can wait.

## RULES

- Fix what you find. This is not a report-only command.
- Never add defensive code for scenarios the architecture already prevents.
  Check constraints, types, and middleware before assuming vulnerability.
- Data integrity fixes MUST use transactions or atomic operations — no application-level locks.
- Auth fixes must be at the API layer, not the UI layer (UI guards are cosmetic, not security).
- After fixing, re-test the specific attack to confirm the fix works.
- Do not refactor code that is not broken.
- Run `npm run build` before committing.

## OUTPUT

```
Commit: `fix: stress-test [target] — N issues found, M fixed (X critical, Y high)`
```

## DOC SYNC

- Update `tasks/lessons.md` with every failure pattern discovered (anti-pattern + fix)
- Update `docs/GAPS_AND_RISKS.md` if any CRITICAL findings represent systemic risks
- Update relevant `docs/AREA_*.md` changelog if behavioral changes were made

```
Commit: `chore: sync docs with [target] stress test findings`
```
