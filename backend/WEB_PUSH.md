# Web Push configuration

The API and notification worker are disabled until these backend environment variables are set:

```dotenv
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:support@chillers.site
```

Generate a key pair from the backend directory with `npx web-push generate-vapid-keys`. Configure the same public and private pair in local development and production backend environments; keep production values separate from development and never commit the private key. The browser reads only the public key from `GET /api/notifications/config`.

The backend worker must remain running to send scheduled campaigns, catalog/favorite alerts, subscription expiry reminders, and match reminders. If the backend is restarted, scheduled campaigns remain stored in MongoDB and are picked up by the next worker tick.
