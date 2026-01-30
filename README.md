# SMS Plus

SMS Plus (or SMS+) is an open-source SMS OTP protection service that adds TypingDNA typing behavior verification to traditional OTPs. Instead of relying on the SMS code alone, it sends a short-lived secure link by text, shows a simple typing challenge on the user’s phone, and reveals the OTP only if the TypingDNA behavioral biometrics check passes. It’s designed to be easy to use, quick to deploy, and friendly for users who require stronger protection without extra hardware or an app install.

You host it as a Node.js web service packaged as a Docker image. It supports:
- Pluggable storage (Mongo, Redis, Firestore)
- Multiple IAM bridges (Okta, Auth0, PingOne, CyberArk, FusionAuth, etc.)
- Your SMS provider (Twilio by default) 

In practice, your IAM system sends the OTP event to SMS+ via a bridge webhook, SMS+ turns it into a link and serves the challenge page, then it verifies or enrolls the user with TypingDNA and enforces attempt limits and lockouts before revealing the OTP.

## How It Works

- Your IAM platform triggers an OTP step and sends a one time password (OTP) to SMS+ via the configured bridge webhook (`POST /hooks/{bridgeId}`).
- SMS+ creates a short-lived challenge session (`cid`), stores the OTP and session state in the configured datastore (Mongo, Redis, or Firestore), and applies TTLs.
- SMS+ converts the OTP into a secure link (`BASE_URL/:cid`) and sends it to the user via the configured SMS provider (Twilio by default).
- The user taps the link and lands on a minimal web page hosted by SMS+ (localized if configured).
- The page shows a short text prompt and records the user’s typing pattern in the phone's browser.
- The page submits the typing pattern to SMS+ in the background (AJAX).
- SMS+ calls TypingDNA (verify and, initially enroll) to authenticate the user by how they type.
- SMS+ enforces security controls before any reveal: per-account and per-challenge attempt limits, lockouts, and cooldowns.
- If verification passes, SMS+ reveals the OTP to the user.
- If verification fails, SMS+ increments counters, may lock the challenge or the user, and returns a clean retry or lockout response.
- SMS+ can also schedule a delayed TypingDNA profile reset if the user is unable to pass the challenge, and allows the user to disable secure links using a short-lived disable token after the user passes verification.

## Integration Requirements

To start, you will need to set up the following:

- **Public service URL**
  - The externally reachable base URL used to generate and host the secure links sent by SMS.

- **Datastore**
  - One storage backend to hold short-lived challenge sessions, OTP state, attempt counters, lockouts, and logs (Mongo, Redis, or Firestore).

- **TypingDNA credentials and defaults**
  - TypingDNA API key and secret, and its defaults (fallback text, timeout). Needed for typing behavior authentication.

- **SMS provider settings**
  - One SMS provider integration (Twilio by default), including the account credentials and a “from” sender/number. This will be used by SMS+ to send the message containing the secure link to the user.

- **IAM bridge(s)**
  - Which bridge integration(s) you want enabled (Okta, Auth0, etc.).
  - A shared secret (credential) per enabled bridge so only your IAM system can call the webhook. To set up your IAM and credential, [see this guide](SMS+IAMSetup.md).

- **(Optional)  Security, lockout policy, localization**
  - Account-level and per-challenge attempt limits, lockout duration, and any disable/reset behavior you want available.
  - Default language, supported languages, and the default text prompt behavior.



## Configuration

Set these via environment variables (`.env` or Cloud Run service vars).

- **Core**
  - `PORT` (default `8080`)
  - `BASE_URL` public URL used in SMS links
  - `HASH_SALT` salt for hashing user identifiers
  - `DEFAULT_LANGUAGE` translation key (default `en`)
- **Data store**
  - `DATA_STORE` one of `mongo`, `redis`, `firestore`
  - Mongo: `MONGO_URI`, `MONGO_DB_NAME`
  - Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
  - Firestore: `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_ID` (optional), `FIREBASE_CREDENTIAL` (JSON object or path; otherwise ADC is used)
- **TypingDNA**
  - `TYPINGDNA_SERVER` (default `https://api.typingdna.com`)
  - `TYPINGDNA_API_KEY`, `TYPINGDNA_API_SECRET`
  - `TYPINGDNA_TEXT_DEFAULT` fallback text; `TYPINGDNA_TIMEOUT_MS` (default `20000`)
- **SMS**
  - `SMS_PROVIDER` (default `twilio`)
  - Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_FROM_NUMBER`
- **Bridges**
  - `ENABLED_BRIDGES` comma-separated list (e.g. `okta,cyberark,fusionauth`)
  - `OKTA_SHARED_SECRET`, `CYBERARK_SHARED_SECRET`, etc. per bridge
- **Lockout / TTL**
  - `MAX_FAILED_ATTEMPTS` (default `5`), `LOCKOUT_DURATION_MINUTES` (default `15`)
  - `PER_CHALLENGE_MAX_FAILED_ATTEMPTS` (default `3`)
  - TTLs are defined in code: token 15m, disable token 10m, logs 30 days
- **Logging**
  - `LOG_REQUESTS` (`true`/`false`), `LOG_LEVEL` (`debug` default)


## Quick Start (Docker)

1) Create a `.env` file with the variables below.

Minimal `.env` example (Mongo + Twilio), for Docker/local run

```
PORT=8080
BASE_URL=https://example.com
DATA_STORE=mongo
MONGO_URI=mongodb+srv://user:pass@cluster/db
MONGO_DB_NAME=sms_plus

TYPINGDNA_API_KEY=your_key
TYPINGDNA_API_SECRET=your_secret

SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_API_KEY=SKxxx
TWILIO_API_SECRET=secret
TWILIO_FROM_NUMBER=+15551234567

ENABLED_BRIDGES=okta
OKTA_SHARED_SECRET=supersecret
HASH_SALT=change_me
```

2) Build the image:
```
docker build -t sms-plus .
```
3) Run:
```
docker run -p 8080:8080 --env-file .env sms-plus
```
The service will initialize the chosen data store, preload challenge texts, and listen on `:8080`.

## Quick Start (Google Cloud Run with Firestore)

1) Set `DATA_STORE=firestore` and supply Firestore credentials:
   - If deploying with the Cloud Run default service account that has Firestore access, omit `FIREBASE_CREDENTIAL` (ADC will be used).
   - If using a key file, set `FIREBASE_CREDENTIAL` to the JSON contents or mount the file and point to its path.
2) Build and push the container:
```
gcloud builds submit --tag gcr.io/PROJECT_ID/sms-plus .
```
3) Deploy to Cloud Run (ensure Firestore API enabled in Datastore mode):
```
gcloud run deploy sms-plus \
  --image gcr.io/PROJECT_ID/sms-plus \
  --region REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars DATA_STORE=firestore,BASE_URL=https://YOUR_SERVICE_URL \
  --set-env-vars TYPINGDNA_API_KEY=...,TYPINGDNA_API_SECRET=...,SMS_PROVIDER=twilio,TWILIO_ACCOUNT_SID=...,TWILIO_API_KEY=...,TWILIO_API_SECRET=...,TWILIO_FROM_NUMBER=...,HASH_SALT=... \
  --set-env-vars ENABLED_BRIDGES=okta,OKTA_SHARED_SECRET=...
```
4) Point your IAM bridge webhooks to `https://YOUR_SERVICE_URL/hooks/{bridgeId}`.

## Development

- Create a `.env` file. See example (Mongo + Twilio) above.
- Install deps: `npm ci`
- Run locally: `npm run dev`
- Build: `npm run build` (outputs to `dist/`)

## Endpoints (summary)

- `POST /hooks/{bridgeId}` – receive OTP webhook from IAM bridge
- `GET /:cid` – render challenge page
- `POST /verify-otp` – verify/enroll TypingDNA for the cid
- `POST /reset-account` – schedule profile reset
- `POST /disable-account` – disable secure codes with a disableTid
