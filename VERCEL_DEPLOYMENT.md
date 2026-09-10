# Deploying Twin Peaks Case Board to Vercel

Follow these quick steps to host your case board on Vercel with a custom public URL:

## 1. Prerequisites
- A free [Vercel](https://vercel.com) account.
- A free [GitHub](https://github.com) account.

## 2. Export / Push Code to GitHub
1. In the AI Studio top menu (or Settings menu), click **"Export to GitHub"** (or download as ZIP and push to a new GitHub repository).
2. Ensure all files including `vercel.json` and `api/server.ts` are included in your repository.

## 3. Import & Deploy on Vercel
1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Select **"Import Git Repository"** and choose your Twin Peaks repository.
3. Vercel will automatically detect **Vite** as the framework preset:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Click **Deploy**. Vercel will build your static frontend and link the `/api` serverless backend route automatically via `vercel.json`.

## 4. (Recommended for Multi-Device Realtime) Connect Supabase
While offline/local mode works on any individual browser, for real-time live synchronization between two separate computers or phones:
1. In your Vercel project dashboard, go to **Settings → Environment Variables**.
2. Add:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
*(Or simply click the "Setup" button directly in the app's top bar on your live Vercel site to paste your Supabase keys without needing to redeploy!)*

## 5. Share with Your Girlfriend & Friends
Once deployed, Vercel gives you an instant live URL like:
`https://twin-peaks-investigation.vercel.app`

Send that link to your girlfriend so she can choose her moniker and join the case board!
