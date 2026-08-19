# Software Vault Area

## Document Control

- Area: Shared software access
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-08-19
- Status: Active in production — first real-credential acceptance remains
- Route: `/licenses` (presented as **Software**)

## Direction

Software is the team's small, internal access cabinet for department accounts such as Photo Mechanic, Envato Elements, APM Music, and Motion Array. It sits above the existing Photo Mechanic license pool so people have one clear place to find software access without changing the pool's two-slot custody model.

The empty state names useful software examples but never seeds or invents credentials. An ADMIN or STAFF user enters the real department credentials through the management dialog.

## Security Contract

1. Active software records are visible only to authenticated internal ADMIN, STAFF, and STUDENT users. External `COLLABORATOR` accounts are denied by the API and do not see the Software navigation entry.
2. ADMIN and STAFF users may create, edit, restore, and archive records. Archive is the reversible lifecycle action; permanent deletion is not exposed.
3. Account email and password are stored as application-encrypted AES-256-GCM ciphertext. The dedicated `SOFTWARE_VAULT_KEY` must decode to exactly 32 bytes; missing or malformed configuration fails closed.
4. The list response decrypts only the account email for the authorized viewer. It never returns the password or ciphertext. Passwords are available only through the separate authenticated reveal endpoint.
5. Password reveal/copy is rate-limited, audited without the secret, and returned with `private, no-store` response headers. The UI keeps a revealed value in client memory for at most 30 seconds, clears it on unmount, and can copy without displaying it.
6. Secret values never appear in audit snapshots, errors, source fixtures, exports, or the repository. Key rotation requires coordinated re-encryption before replacing the configured key.

## Data Model

Migration `0125_software_credentials` adds `SoftwareCredential` with a unique name, optional category and website URL, encrypted account-email and password fields, archive timestamp, and created/updated timestamps. It intentionally has no user relation: the account is shared, while access and changes are actor-scoped through authentication and audit records.

## API Surface

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/software` | `software:view` | List active records; ADMIN/STAFF may request archived records too |
| POST | `/api/software` | `software:manage` | Create a software record and encrypt both secrets |
| PATCH | `/api/software/[id]` | `software:manage` | Update metadata/secrets or restore/archive a record |
| DELETE | `/api/software/[id]` | `software:manage` | Archive a record through the reversible lifecycle path |
| GET | `/api/software/[id]/secret` | `software:reveal` | Rate-limited password reveal/copy request |

All mutations use the existing authenticated audit path. Secret endpoints return only the requested password and never include it in the audit event.

## UI Contract

- `SoftwareVault.tsx` is the first section of the existing `/licenses` page.
- Each active card leads with software name/category, optional official website, account email, and a masked password row.
- Copy Email is available from the list. Show Password and Copy Password explicitly request the secret; copy does not require rendering the password.
- Staff/admin management controls use a dialog for add/edit and an AlertDialog for archive. Editing leaves the password blank unless it is intentionally replaced.
- Admin/staff archived records are separated from active records and can be restored.
- The existing Photo Mechanic pool remains the second section and keeps its current student claim, masking, expiry, and staff/admin management behavior.

## Permissions

- `software:view` / `software:reveal`: `ADMIN`, `STAFF`, `STUDENT`
- `software:manage`: `ADMIN`, `STAFF`
- `COLLABORATOR` is intentionally absent from the central permission map.

## Rollout Gates and Known Gaps

- Configure one stable, independently generated 32-byte base64 `SOFTWARE_VAULT_KEY` per environment. Production has a Sensitive key configured; preview and development must receive separate keys before vault use there.
- Migration `0125_software_credentials` is applied and read back in production with checksum `b8debcbf66333da3b82f1eebac391c53b64df1d18e34a95f515864621d112f82`; the initial table contains zero credential rows.
- Authenticated desktop and narrow-width production proof passed for navigation, empty-state rendering, list redaction, responsive layout, and a clean console. Reveal/copy and archive/restore remain pending until an administrator enters the first real department credential; no test credential will be fabricated.
- Key rotation is an operational re-encryption procedure, not a self-service UI. Per-record entitlements, sharing, and password history are deliberately out of scope for this first internal vault.

## Change Log

- 2026-08-19: Shipped the encrypted Software Vault to production in commit `2548f4ce` and deployment `dpl_BuEMXuk96yzqyjj9sPTTAPEAQ2tS`; configured a production-only Sensitive key, applied/read back migration `0125_software_credentials`, and passed authenticated desktop/narrow empty-state and clean-console proof. First real-credential reveal/copy/archive/restore acceptance remains open.
- 2026-08-19: Added the local encrypted Software Vault slice, preserved `/licenses` compatibility, and tracked migration, environment-key, and authenticated browser proof as rollout gates.
