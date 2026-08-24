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

The project goes beyond isolated button-click demos. It combines a Vite frontend with Vercel Functions, MongoDB-backed authentication, email delivery, form validation, UTM tooling, and admin-only diagnostics to create an end-to-end tracking sandbox.

## Features

| Area | What is included |
| --- | --- |
| **Analytics** | Consent-aware `dataLayer` events, page views, conversion outcomes, and attribution parameters |
| **Campaigns** | UTM link builder with editable channels, custom parameters, copy, and open actions |
| **Conversions** | Contact, callback, and newsletter flows with success and error tracking |
| **Authentication** | MongoDB-backed registration, login, logout, signed sessions, and role-aware UI |
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
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
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
| Data and auth | MongoDB Atlas, HTTP-only cookies, Web Crypto / Node crypto APIs |
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
- MongoDB Atlas credentials for authentication features
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
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB` | Database name; defaults to `analytics_practice` |
| `SESSION_SECRET` | Long random value used to sign authentication sessions |
| `RESEND_API_KEY` | Resend credential for form emails |
| `CONTACT_TO_EMAIL` | Recipient for form submissions |
| `CONTACT_FROM_EMAIL` | Verified sender or Resend test sender |

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=analytics_practice
SESSION_SECRET=replace-this-with-a-long-random-secret
RESEND_API_KEY=re_your_resend_api_key
CONTACT_TO_EMAIL=you@example.com
CONTACT_FROM_EMAIL=onboarding@resend.dev
```

Never commit `.env.local`. Resend's test sender generally delivers only to the email associated with the Resend account; use a verified domain for production delivery.

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

The first registered user receives `admin_status: 1`; later users receive `admin_status: 0`. Admin accounts can access the analytics debug panel, fire `debug_test_event`, populate forms with test data, and simulate conversion errors. Public visitors and basic users can still complete all real conversion flows.

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

The repository is configured for Vercel deployment with SPA rewrites and serverless API routes. Add every environment variable in Vercel, allow the deployment to connect through MongoDB Atlas Network Access, and redeploy after changing environment values.

- Passwords are salted and hashed before storage.
- Authentication uses a signed HTTP-only cookie.
- Personal form data is not included in analytics events.
- Secrets remain in local or Vercel environment variables.
- GTM container changes must be published separately from application deployments.

---

[Repository](https://github.com/AlekdSANS/conversion-tracking) · [More projects by AlekdSANS](https://github.com/AlekdSANS?tab=repositories)
