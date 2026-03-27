# GitHub & Vercel Deployment Guide

## Step-by-Step Instructions

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Fill in the repository details:
   - **Repository name**: `kidgo-pwa`
   - **Description**: Kidgo Progressive Web App - Event discovery for children
   - **Visibility**: Public
3. Click "Create repository"

### Step 2: Push Code to GitHub

Copy and paste these commands in PowerShell (in your project folder):

```powershell
# Navigate to your project
cd "C:\Users\<YourUsername>\Desktop\Projekt Kidgo\kidgo-pwa"

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Kidgo PWA - Event discovery app"

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kidgo-pwa.git

# Push to GitHub
git push -u origin main
```

**First time pushing?** You may need to authenticate:
- GitHub will prompt you to login
- Or use a Personal Access Token (generate at https://github.com/settings/tokens)

### Step 3: Deploy on Vercel

Once your code is on GitHub:

1. Go to https://vercel.com/new
2. Click "Continue with GitHub"
3. Search for "kidgo-pwa" and select it
4. Click "Import"
5. In the **Environment Variables** section, add:
   - Key: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://wfkzxqscskppfivqsgno.supabase.co`
   - Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your full key)
6. Click "Deploy"

### Step 4: Your App is Live!

Vercel will give you a URL like: `https://kidgo-pwa.vercel.app`

---

## Troubleshooting

**Problem**: Git not working
- Install from https://git-scm.com/download/win

**Problem**: Git authentication fails
- Use Personal Access Token instead of password
- Generate at: https://github.com/settings/tokens/new
- Permissions needed: `repo` (full control of private repositories)

**Problem**: Build fails on Vercel
- Check Vercel logs in deployment details
- Ensure environment variables are set correctly
- Check that `package.json` exists and has all dependencies

**Problem**: App works locally but not on Vercel
- Verify `.next/` is in `.gitignore`
- Make sure `node_modules/` is in `.gitignore`
- Check Vercel build logs for errors

---

## Quick Command Reference

```powershell
# Check git status
git status

# View recent commits
git log --oneline

# Push changes to GitHub
git push

# Pull latest changes
git pull
```
