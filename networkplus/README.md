This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Setup Guide

Follow these steps to set up the necessary services for the application.

### 1. Environment Variables

Copy the example environment file and fill in the values:

```bash
cp .env.example .env
```

### 2. Database (Supabase)

1.  Create a new project on [Supabase](https://supabase.com/).
2.  Go to **Project Settings** > **Database**.
3.  Under **Connection string**, select **URI**.
    *   **Transaction Mode (Pooler)**: Use this for `DATABASE_URL`. It usually uses port `6543` and requires `?pgbouncer=true`.
    *   **Session Mode**: Use this for `DIRECT_URL`. It usually uses port `5432`.
4.  Make sure to replace `[PASSWORD]` with your actual database password.

### 3. Prisma

Once you have your database URLs set in `.env`, run the following commands:

```bash
# Push the schema to your database
npx prisma db push

# Generate the Prisma Client
npx prisma generate
```

### 4. Authentication (Google Cloud)

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project or select an existing one.
3.  Navigate to **APIs & Services** > **Credentials**.
4.  Configure the **OAuth consent screen** (Internal or External).
5.  Create **OAuth 2.0 Client IDs** (Web application).
    *   **Authorized JavaScript origins**: `http://localhost:3000`
    *   **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`
6.  Copy the **Client ID** and **Client Secret** to your `.env` file.

### 5. Firebase (Push Notifications)

1.  Create a project in the [Firebase Console](https://console.firebase.google.com/).
2.  **Web App**: Add a Web App to your project and copy the configuration object values to the `NEXT_PUBLIC_FIREBASE_*` variables in `.env`.
3.  **Cloud Messaging**:
    *   Go to **Project Settings** > **Cloud Messaging**.
    *   Under **Web Push certificates**, generate a **Key pair** and copy it to `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4.  **Service Account**:
    *   Go to **Project Settings** > **Service accounts**.
    *   Click **Generate new private key** to download the JSON.
    *   Copy `client_email` to `FIREBASE_CLIENT_EMAIL` and `private_key` to `FIREBASE_PRIVATE_KEY` (ensure newlines are handled as `\n`).

### 6. Cron Jobs

To secure the cron job endpoints, generate a random secret:

```bash
openssl rand -base64 32
```

Set this as `CRON_SECRET` in your `.env` and in your deployment environment (e.g., Vercel).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
