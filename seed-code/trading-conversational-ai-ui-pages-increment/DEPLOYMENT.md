# Deployment Guide for Trading Conversational AI UI

This guide will walk you through deploying your 2-page mockup application to Vercel.

## 🎯 Project Overview

This project contains:

- **Page A (Landing Page)**: Accessible at `/` (root URL)
- **Page B (Conversational AI Page)**: Accessible at `/chat`

## 📦 Deployment Methods

### Method 1: Deploy via Vercel Dashboard (Recommended for Beginners)

#### Step 1: Login to Vercel

1. Go to https://vercel.com
2. Click "Login" (use your existing account)

#### Step 2: Import Your Project

1. Click "Add New..." button (top right)
2. Select "Project"
3. Choose "Import Git Repository"
4. You'll need to connect your GitHub account if not already connected
5. Select the repository: `ripper7375/trading-conversational-ai-ui`
6. Click "Import"

#### Step 3: Configure Project Settings

Vercel will auto-detect Next.js settings. Verify:

- **Framework Preset**: Next.js
- **Root Directory**: `./` (leave as default)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

**Important**:

- **Project Name**: Give it a unique name like `trading-conversational-ai-mockup` (this will be different from your `trading-alerts-saas-v7` project)
- **Environment Variables**: None needed for this mockup project

#### Step 4: Deploy

1. Click "Deploy" button
2. Wait 2-3 minutes for the build to complete
3. Once done, you'll get a live URL like: `https://trading-conversational-ai-mockup.vercel.app`

#### Step 5: Access Your Pages

- **Landing Page**: https://your-project-name.vercel.app/
- **Conversational AI Page**: https://your-project-name.vercel.app/chat

---

### Method 2: Deploy via Vercel CLI (Advanced)

If you prefer using the command line:

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Login

```bash
vercel login
```

#### Step 3: Deploy from Project Root

```bash
# From /home/user/trading-conversational-ai-ui directory
vercel
```

Follow the prompts:

- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (create new project)
- What's your project's name? `trading-conversational-ai-mockup`
- In which directory is your code located? `./`
- Auto-detected Next.js settings - override? **N**

#### Step 4: Deploy to Production

```bash
vercel --prod
```

---

## 🔄 Automatic Deployments

Once set up, Vercel will automatically deploy:

- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches (like your current `claude/create-mockup-pages-01Vvs9NwWyuVVsk4bj8zUtMQ`)

---

## 🔐 Keeping Projects Separate

Your two Vercel projects will be completely separate:

| Project                      | Purpose                        | Git Repo                     |
| ---------------------------- | ------------------------------ | ---------------------------- |
| trading-alerts-saas-v7       | Main SaaS Development          | trading-alerts-saas-v7       |
| trading-conversational-ai-ui | Marketing Feasibility Research | trading-conversational-ai-ui |

Each project has its own:

- Separate deployment URL
- Separate build settings
- Separate environment variables
- Separate analytics/logs

---

## 📊 Post-Deployment

### Monitoring Your Deployment

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. You'll see both projects listed separately
3. Click on `trading-conversational-ai-ui` to see:
   - Deployment history
   - Analytics
   - Build logs
   - Domain settings

### Custom Domain (Optional)

If you want a custom domain for this mockup:

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

---

## 🐛 Troubleshooting

### Build Fails

- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility (project uses Next.js 16)

### Pages Not Loading

- Verify routes in Vercel dashboard
- Check browser console for errors
- Ensure all environment variables are set (if any)

### Need Help?

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs

---

## ✅ Checklist

- [ ] Vercel account created/logged in
- [ ] Project imported to Vercel
- [ ] Unique project name set (different from v7)
- [ ] Deployment successful
- [ ] Landing page (/) accessible
- [ ] Chat page (/chat) accessible
- [ ] Share URL with stakeholders for feedback

---

## 📝 Notes

- This is a **separate project** from trading-alerts-saas-v7
- No shared resources or settings between the two projects
- Perfect for A/B testing and market research
- Can be deleted independently without affecting v7

Good luck with your market feasibility research! 🚀
