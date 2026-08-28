# Free Cloud Deployment Guide

This guide will walk you through hosting your Healthcare AI Platform for **100% free** using Vercel, Render, and Neon.

Because you are using free tiers, please note:
- **Render instances "sleep"** after 15 minutes of inactivity. When you try to access the backend or n8n after a long pause, the first request may take up to 60 seconds to load as the server wakes up.
- **n8n is memory intensive.** Render's free tier provides 512MB RAM, which is enough to run n8n, but complex workflows may occasionally cause it to restart.

---

## Prerequisites
1. A **GitHub** account.
2. A free **Neon.tech** account (for PostgreSQL).
3. A free **Render.com** account (for Backend & n8n).
4. A free **Vercel.com** account (for Frontend).

### Step 1: Push code to GitHub
1. Create a new public or private repository on GitHub.
2. Push this entire `N8N-healthcare` project folder to that repository.

---

## Step 2: Setup Database (Neon)
1. Go to [Neon.tech](https://neon.tech) and create a free project.
2. Create a database (e.g., `healthcare_platform`).
3. Under the **Dashboard**, find your **Connection Details**. Click the "Pooled connection" toggle.
4. Copy the connection string. It will look like this: `postgresql://user:password@ep-super-cool-12345.pooler.neon.tech/dbname?sslmode=require`
5. Keep this string handy.
6. *Important*: You will need to run your `database/schema.sql` and `database/seed.sql` on this new database. You can do this using the SQL Editor built directly into the Neon dashboard! Just paste the contents of both files into the Neon SQL editor and click "Run".

---

## Step 3: Deploy Backend & n8n (Render)
We have prepared a `render.yaml` Blueprint to make this a one-click process.

1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub account and select your `N8N-healthcare` repository.
4. Render will automatically detect the `render.yaml` file and prepare to deploy **healthcare-backend** and **healthcare-n8n**.
5. During setup, Render will ask you to fill out several missing Environment Variables (`sync: false`).

Fill them out as follows:
- `DATABASE_URL`: The Neon connection string you copied in Step 2.
- `GROQ_API_KEY`: Your Groq API Key.
- `N8N_WEBHOOK_URL`: We don't know the n8n URL yet, so just put `https://temp.onrender.com` for now. You can update this later in the Render dashboard.
- `N8N_BASIC_AUTH_USER` / `PASSWORD`: Create a secure username and password to log into your n8n dashboard.
- `N8N_ENCRYPTION_KEY`: Type any random string of characters (e.g. `asd9f87dsaf987asdf`).
- `DB_POSTGRESDB_*`: Use the details from your Neon connection string. Break the connection string apart into Host, User, Password, and Database.

6. Click **Apply**. Render will begin building both services. This may take 5-10 minutes.
7. Once finished, note the URLs for both the backend (e.g., `https://healthcare-backend-xxx.onrender.com`) and n8n (e.g., `https://healthcare-n8n-xxx.onrender.com`).

---

## Step 4: Deploy Frontend (Vercel)
1. Go to [Vercel.com](https://vercel.com) and click **Add New > Project**.
2. Import your `N8N-healthcare` GitHub repository.
3. Vercel will automatically detect the `vercel.json` file.
4. You do not need to change any build commands. Just click **Deploy**.
5. Once deployed, note your Vercel URL (e.g., `https://n8n-healthcare.vercel.app`).

---

## Step 5: Final Configuration Linkup

Now that everything is online, we just need to point them at each other.

1. **Point the Frontend to the Backend:**
   - Open your GitHub repository.
   - Edit the file `frontend/js/api.js`.
   - On line 7, replace `https://YOUR_RENDER_BACKEND_URL.onrender.com/api` with your actual backend URL from Step 3.
   - Commit the change. Vercel will automatically redeploy the frontend in seconds!

2. **Update n8n Webhook URLs:**
   - Go to your Render Dashboard > **healthcare-backend** > **Environment**.
   - Update `N8N_WEBHOOK_URL` to your actual n8n URL from Step 3.
   - Do the same in **healthcare-n8n** > **Environment** > update `WEBHOOK_URL`.

3. **Configure n8n:**
   - Open your n8n URL in your browser and log in with the credentials you set.
   - Go to Settings > Import from file, and import the 3 JSON files from `n8n/workflows/`.
   - Setup your Postgres credential in n8n (Credentials > + > Postgres) using your Neon database details.
   - Go into the Orchestrator workflow and select your new Postgres credential in the 3 Postgres nodes.
   - Click "Active" in the top right of the workflow to make it run permanently!

**You are fully live!** Navigate to your Vercel URL to start using the system globally.
