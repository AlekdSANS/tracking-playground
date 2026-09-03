# Conversion Tracking

### A consent-aware analytics playground for GTM, GA4, campaign attribution, and real conversion flows.

[![Project status](https://img.shields.io/badge/status-portfolio_project-2ea44f?style=flat-square)](https://github.com/AlekdSANS/conversion-tracking)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Vercel](https://img.shields.io/badge/deploys_to-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)

[About](#about) · [Features](#features) · [Analytics flow](#analytics-flow) · [Getting started](#getting-started) · [GTM setup](#gtm-setup) · [Testing](#testing-analytics)

---

## About

Conversion Tracking is a compact React application built to practise analytics implementation in realistic user journeys. Visitors can navigate campaign links, manage analytics consent, submit forms, and register or log in while the application sends structured events through `window.dataLayer`.

The project goes beyond isolated button-click demos. It combines a Vite frontend with Vercel Functions, Neon PostgreSQL-backed authentication, email delivery, form validation, UTM tooling, and admin-only diagnostics to create an end-to-end tracking sandbox.

## Features

| Area | What is included |
| --- | --- |
| **Analytics** | Consent-aware `dataLayer` events, page views, conversion outcomes, and attribution parameters |
| **Campaigns** | UTM link builder with editable channels, custom parameters, copy, and open actions |
| **Conversions** | Contact, callback, and newsletter flows with success and error tracking |
| **Authentication** | Neon PostgreSQL-backed registration, email verification, login, logout, signed sessions, and role-aware UI |
| **Validation** | Country-aware phone formatting plus live email format and typo feedback |
| **Email** | Resend-powered form delivery through Vercel API routes |
| **Diagnostics** | Admin-only event inspector, test events, random form data, and simulated failures |
| **Privacy** | Explicit analytics consent, persisted preferences, and no personal form data in events |

## Analytics flow

```mermaid
flowchart LR
    A[Visitor action] --> B{Analytics consent?}
    B -- Not granted --> C[Event withheld]
    B -- Granted --> D[window.dataLayer]
    D --> E[Google Tag Manager]
    E --> F[GA4 event]
    E --> G[Google Ads conversion]
```

Custom analytics events are withheld until analytics consent is granted. Once allowed, the application enriches events with available campaign context and pushes them to the data layer for GTM to route.

## Stack

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![React Router](https://img.shields.io/badge/React_Router_7-CA4245?style=flat-square&logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Neon](https://img.shields.io/badge/Neon_PostgreSQL-00E699?style=flat-square&logo=postgresql&logoColor=white)](https://neon.com/)
[![Vercel](https://img.shields.io/badge/Vercel_Functions-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/docs/functions)
[![Resend](https://img.shields.io/badge/Resend-000000?style=flat-square&logo=resend&logoColor=white)](https://resend.com/)
[![Google Tag Manager](https://img.shields.io/badge/Google_Tag_Manager-246FDB?style=flat-square&logo=googletagmanager&logoColor=white)](https://tagmanager.google.com/)
[![Google Analytics](https://img.shields.io/badge/Google_Analytics_4-E37400?style=flat-square&logo=googleanalytics&logoColor=white)](https://analytics.google.com/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)

| Layer | Technology |
| --- | --- |
| Interface | React 19, React Router, CSS |
| Development | Vite 8, ESLint |
| API | Node.js, Vercel Functions |
| Data and auth | Neon PostgreSQL, HTTP-only cookies, Web Crypto / Node crypto APIs |
| Forms and email | `libphonenumber-js`, Resend |
| Analytics | Google Tag Manager, GA4, Google Ads-style conversions |
| Testing | Vitest, Testing Library, user-event, jsdom |

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Home and entry point |
| `/contact` | Contact form |
| `/callback` | Callback request |
| `/newsletter` | Newsletter signup |
| `/utm-builder` | Campaign URL builder |
| `/tag-lab` | Verified-admin-only GTM and GA4 lab |
| `/tag-workspace` | Verified-admin-only disposable tag workspace |
| `/login` | Registration and login |
| `/thank-you` | Form success page |
| `/privacy` | Consent and privacy information |

## Tracked events

| Journey | Events |
| --- | --- |
| Navigation | `page_view`, `thank_you_page_view` |
| Contact form | `contact_form_start`, `contact_form_submit`, `contact_form_success`, `contact_form_error` |
| Other conversions | `callback_request`, `newsletter_signup`, `contact_action_click` |
| Authentication | `login_success`, `login_error`, `register_success`, `register_error`, `logout` |
| Campaign tools | `utm_builder_copy_link`, `utm_builder_open_link` |
| Consent and diagnostics | `consent_update`, `debug_test_event` |

Events can include contextual parameters such as `page_path`, `traffic_source`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `has_gclid`, `form_name`, `submission_status`, `error_type`, `auth_method`, `account_type`, and `admin_status`.

> [!NOTE]
> A GA4 page view can appear even when custom event tags are not configured correctly. Every custom action still needs a matching GTM Custom Event trigger and GA4 Event tag.

## Getting started

### Requirements

- A current Node.js release
- npm
- A Neon PostgreSQL database for authentication features
- A Resend API key for email delivery

### Installation

```bash
git clone https://github.com/AlekdSANS/conversion-tracking.git
cd conversion-tracking
npm install
cp .env.example .env.local
npm run dev
```

Open the local address printed by Vite. To reproduce Vercel Function routing locally, run `npx vercel dev` instead of the Vite development server.

## Environment

Add these values to `.env.local` for development and to the Vercel project settings for deployment.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Neon PostgreSQL connection string |
| `SESSION_SECRET` | Long random value used to sign authentication sessions |
| `APP_URL` | Public application origin used in email-verification links |
| `RESEND_API_KEY` | Resend credential for form emails |
| `AUTH_FROM_EMAIL` | Verified sender used for account-verification emails |
| `CONTACT_TO_EMAIL` | Recipient for form submissions |
| `CONTACT_FROM_EMAIL` | Verified sender or Resend test sender |
| `GTM_GOOGLE_CLIENT_ID` | Google OAuth web-client ID with the Tag Manager API enabled |
| `GTM_GOOGLE_CLIENT_SECRET` | Server-only OAuth client secret |
| `GTM_OAUTH_REDIRECT_URI` | Exact authorized callback URI, such as `http://localhost:3000/api/gtm-oauth-callback` |
| `GTM_OAUTH_COOKIE_SECRET` | Stable random value of at least 32 characters, separate from `SESSION_SECRET`, used to sign OAuth state and encrypt GTM access cookies |

```env
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=replace-this-with-a-long-random-secret
APP_URL=http://localhost:3000
RESEND_API_KEY=re_your_resend_api_key
AUTH_FROM_EMAIL=Tracking Playground <onboarding@resend.dev>
CONTACT_TO_EMAIL=you@example.com
CONTACT_FROM_EMAIL=onboarding@resend.dev
GTM_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GTM_GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GTM_OAUTH_REDIRECT_URI=http://localhost:3000/api/gtm-oauth-callback
GTM_OAUTH_COOKIE_SECRET=replace-with-a-stable-separate-random-secret-of-at-least-32-characters
```

Never commit `.env.local`. Resend's test sender generally delivers only to the email associated with the Resend account; use a verified domain for production delivery.

Before using authentication, run [`db/schema.sql`](db/schema.sql) in the Neon SQL Editor. It is safe to run again after an earlier version of the schema because the email-verification columns are added idempotently. Keep `SESSION_SECRET` unchanged when moving an existing deployment so already-issued session cookies remain valid. Existing MongoDB password hashes can be copied into the `pass` column without modification.

New accounts receive a verification link that expires after 24 hours and cannot log in until it is used. Resend requests are limited to one database token refresh per minute and always return the same public response. Accounts created before email verification was enabled must have `email` backfilled and `email_verified_at` set before they can log in; after backfilling every legacy account, set the column requirement with `ALTER TABLE users ALTER COLUMN email SET NOT NULL;`.

The Tag Lab and its workspace are available only to the verified administrator. Client routes redirect other visitors to login, and every GTM API route independently checks the signed application session. OAuth state and encrypted access cookies are bound to that application's user ID, so switching accounts in the same browser cannot reuse another account's Google authorization. Logging out expires the application session, pending OAuth state, and GTM access cookie together.

The API connection uses only the `tagmanager.readonly` OAuth scope. Access tokens are encrypted in HTTP-only cookies, limited to ten minutes, and never copied into the virtual workspace. Enable the Tag Manager API in Google Cloud, register `GTM_OAUTH_REDIRECT_URI` exactly, and use `npx vercel dev` when testing the API locally.

## GTM setup

The GTM loader is configured in `index.html` with container ID `GTM-N386PQB8`.

For each custom event:

1. Create a **Custom Event** trigger in Google Tag Manager.
2. Set its event name to the exact application event, such as `login_success`.
3. Create a GA4 Event tag using the same event name.
4. Add the data-layer variables you want GA4 to receive as event parameters.
5. Connect the trigger, save the changes, and publish the container.

If an event fires in Tag Assistant but not on the public site, confirm that the container version is published and the GA4 Event tag is not blocked by GTM consent settings.

## Admin diagnostics

The first registered user receives `admin_status: 1`; later users receive `admin_status: 0`. After verifying their email, that administrator can access the GTM and GA4 lab, the analytics debug panel, test events, random form data, and simulated failures. Public visitors and basic users can still complete all real conversion flows, but cannot access GTM account integrations.

> [!WARNING]
> Register the intended administrator before opening a new deployment to public signups.

## Testing analytics

1. Open the application and grant analytics consent.
2. Log in with an admin account and open the analytics debug panel.
3. Trigger a journey and confirm `pushed_to_data_layer: true`.
4. In browser DevTools, filter Network requests for `collect`.
5. Check the GA4 payload for `tid=G-...` and `en=event_name`.
6. Use GA4 DebugView for Tag Assistant or debug sessions, and GA4 Realtime for ordinary visits.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint checks |
| `npm test` | Run the Vitest suite once |
| `npm run preview` | Preview the production build locally |
| `npx vercel dev` | Run the frontend with local Vercel Functions |

## Deployment and security

The repository is configured for Vercel deployment with SPA rewrites and serverless API routes. Add every environment variable in Vercel, use Neon's pooled connection string for `DATABASE_URL`, and redeploy after changing environment values.

For each Vercel environment you deploy:

1. Set `APP_URL` to that environment's exact public origin.
2. Set `GTM_OAUTH_REDIRECT_URI` to the exact callback URL on that origin and add the same URI to the Google OAuth web client.
3. Generate separate high-entropy values for `SESSION_SECRET` and `GTM_OAUTH_COOKIE_SECRET`, each at least 32 characters, and keep them stable across deployments and function instances in that environment.
4. Configure the Neon and Resend values, deploy, then verify registration, email confirmation, login, GTM connection, account switching, and logout from the deployed origin.

Changing either cookie secret invalidates the corresponding active sessions. This hardening release also invalidates older GTM cookies that were not account-bound, so the administrator must connect Google Tag Manager once after deployment.

- Passwords are salted and hashed before storage.
- Authentication uses a signed HTTP-only cookie.
- GTM routes and API handlers require a verified administrator session.
- Google OAuth state and encrypted GTM access are bound to the same application account and cleared during logout.
- Personal form data is not included in analytics events.
- Secrets remain in local or Vercel environment variables.
- GTM container changes must be published separately from application deployments.

---

[Repository](https://github.com/AlekdSANS/conversion-tracking) · [More projects by AlekdSANS](https://github.com/AlekdSANS?tab=repositories)
