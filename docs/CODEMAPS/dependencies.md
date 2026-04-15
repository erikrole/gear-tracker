<!-- Generated: 2026-04-14 | Files scanned: 142 | Token estimate: ~500 -->
# Dependencies — gear-tracker

## Runtime Dependencies

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| next | 15.5.14 | App framework (App Router) |
| react | 19.0.0 | UI runtime |
| typescript | 5.9.3 | Type safety |

### Database
| Package | Version | Purpose |
|---------|---------|---------|
| @prisma/client | 6.19.3 | ORM client |
| @prisma/adapter-neon | 6.19.3 | Neon serverless adapter |
| prisma | 6.19.3 | CLI / migrations |

### External Services
| Package | Version | Purpose |
|---------|---------|---------|
| @vercel/blob | 2.3.3 | Image storage |
| resend | 6.10.0 | Transactional email |
| @sentry/nextjs | 10.47.0 | Error monitoring |

### UI & Styling
| Package | Version | Purpose |
|---------|---------|---------|
| tailwindcss | 4.2.1 | Utility CSS |
| @radix-ui (radix-ui) | 1.4.3 | Headless UI primitives (shadcn base) |
| lucide-react | 0.577.0 | Icons |
| motion | 12.38.0 | Animations |
| geist | 1.7.0 | Vercel font |
| @fontsource/barlow | 5.2.8 | Barlow font |
| recharts | 3.8.1 | Charts |
| cmdk | 1.1.1 | Command palette |
| vaul | 1.1.2 | Drawer/sheet component |
| sonner | 2.0.7 | Toast notifications |
| react-day-picker | 9.14.0 | Date pickers |

### Data & State
| Package | Version | Purpose |
|---------|---------|---------|
| @tanstack/react-query | 5.96.2 | Server state / data fetching |
| @tanstack/react-table | 8.21.3 | Table utilities |
| zod | 3.24.2 | Schema validation |
| date-fns | 4.1.0 | Date utilities |
| class-variance-authority | 0.7.1 | Component variant styling |
| clsx | 2.1.1 | CSS class merging |
| tailwind-merge | 3.5.0 | Tailwind conflict resolution |

### Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| qrcode | 1.5.4 | QR code generation |
| barcode-detector | 3.1.2 | Barcode scanning (camera) |
| bcryptjs | 3.0.3 | Password hashing |
| @blocknote/* | 0.47.3 | Rich text / block editor |

## Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| vitest | 3.0.6 | Unit testing |
| @next/bundle-analyzer | 16.2.2 | Bundle size analysis |
| @types/node | 22.19.17 | Node type defs |
| postcss | 8.5.8 | CSS processing |

## Environment Variables
```
DATABASE_URL            Neon PostgreSQL connection string
SESSION_SECRET          Cookie session signing key
SESSION_COOKIE_NAME     Cookie name
CRON_SECRET             Vercel cron authorization token
RESEND_API_KEY          Email delivery key
BLOB_READ_WRITE_TOKEN   Vercel Blob access token
SENTRY_DSN              Sentry project DSN
SENTRY_AUTH_TOKEN       Sentry release token
APP_TIMEZONE            App timezone (default: America/Chicago)
SEED_ADMIN_PASSWORD     Initial admin password for seed script
```

## Cron Jobs
```
/api/cron/notifications   — Send pending notifications (schedule: TBD in vercel.json)
/api/cron/audit-archive   — Archive old audit logs
```
