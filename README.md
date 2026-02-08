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

## Internal preview on a VPS (no domain required)

Use this setup to share a private preview by IP only (e.g., `http://SEU_IP:3001`) without pointing DNS.

1) **SSH into the VPS and clone the repo**

```bash
git clone <repo-url>
cd ssepa
```

2) **Install dependencies**

```bash
npm install
```

3) **Configure environment variables**

Create a `.env` file with the database URL used by Prisma:

```bash
cat <<'EOF' > .env
DATABASE_URL="file:./dev.db"
EOF
```

4) **Run the app on a private port**

```bash
npm run dev -- --hostname 0.0.0.0 --port 3001
```

5) **Open the preview by IP**

Access `http://SEU_IP:3001` in the browser.

> Optional: If your VPS firewall blocks the port, allow it (example: `ufw allow 3001`).

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
