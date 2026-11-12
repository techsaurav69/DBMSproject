# Community aid network

Communities, memberships, images, announcements, offers, and messages use the existing PostgreSQL database. No extra storage account or chat service is required.

## Setup and migration

Run `npm run db:migrate` using the deployment's PostgreSQL connection and verified provider CA. Migration `012_community_approval_and_chat.sql` adds the required tables and columns. Existing communities become **pending**; their memberships and offers remain intact. A coordinator must review them before they appear in the approved directory. If the migration is missing, the overview API returns an explicit setup error rather than simulated data.

## Access

- New requests, including requests from coordinators, start pending. Only their creator and coordinators can view pending or rejected groups and their images/offers.
- Only a coordinator can approve or reject a pending community. An optional rejection reason is visible to the requester. Review decisions and image/announcement edits are audited.
- Any signed-in participant can join an approved community. Joining grants membership immediately. There is no separate membership approval queue.
- Chat history, sending messages, and recording offers require both an approved community and current membership. Coordinators must also join to use chat.
- The owner or a coordinator can update images and replace/remove the one pinned announcement. Approval, membership and ownership checks run on the API as well as in the interface.

## Images and chat

PNG, JPEG and WebP images are limited to 512 KiB each, with browser decoding, upload previews, and server checks of file size and raster signatures. SVG, HTML and other formats are rejected. Two optional images per community are stored as `bytea` and fetched through authenticated endpoints. Logos fall back to a default symbol; QR images load only on demand in details, with an optional caption. These are display images; CrisisGrid does not process payments or QR destinations.

Chat loads the latest 50 messages, supports earlier-history pagination, and polls every five seconds while the member dialog is open and the page is visible. It uses persistent server records, not browser-only messages or WebSockets. Text is rendered as plain text.

## Verification

`npm test` covers community UI and backend permissions. After an API build, `node scripts/verify-community.cjs` tests the real service with the configured database. It uses a unique temporary schema inside a transaction, then rolls back all fixtures. It requires schema-creation permission, PostgreSQL credentials, and a valid TLS CA configuration. It does not approve, reject, or delete existing communities.
