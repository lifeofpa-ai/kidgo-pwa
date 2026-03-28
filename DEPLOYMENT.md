# Kidgo PWA - Deployment Guide

## Project Overview
- **Framework**: Next.js 15 with TypeScript
- **Database**: Supabase PostgreSQL (365 events)
- **Features**: Search, Filtering, Favorites, Interactive Map View
- **Hosting**: Vercel (Free Tier)

## Pre-Deployment Checklist

✅ All features tested and working:
- Event search with 466 results
- Category filtering (7 categories)
- List and Map view toggle
- Favorites functionality with localStorage
- Interactive map with Leaflet

✅ Environment variables configured:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Option 1: Deploy via Vercel CLI (Recommended)

### Prerequisites
- Node.js installed
- Vercel CLI installed (`npm i -g vercel`)
- GitHub account (optional but recommended)

### Steps

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy directly from your machine**:
   ```bash
   cd /path/to/kidgo-pwa
   vercel
   ```

3. **Follow the prompts**:
   - Link to your Vercel account (create one if needed)
   - Select project settings
   - Add environment variables when prompted:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Your app will be live** at a Vercel URL!

## Option 2: Deploy via GitHub (Recommended for CI/CD)

### Prerequisites
- GitHub account
- Git installed on your machine

### Steps

1. **Initialize git (if not done)**:
   ```bash
   cd /path/to/kidgo-pwa
   git init
   git add .
   git commit -m "Initial commit: Kidgo PWA"
   ```

2. **Create a GitHub repository** at https://github.com/new

3. **Push your code**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/kidgo-pwa.git
   git branch -M main
   git push -u origin main
   ```

4. **Connect to Vercel**:
   - Visit https://vercel.com/new
   - Import your GitHub repository
   - Configure project settings
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click "Deploy"

## Option 3: Manual Deploy via Vercel Dashboard

1. Visit https://vercel.com
2. Create an account (if needed)
3. Click "New Project"
4. Upload your project files
5. Configure environment variables
6. Deploy

## Environment Variables

Make sure these are set in your Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL=https://wfkzxqscskppfivqsgno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Post-Deployment

After successful deployment:

1. **Test the live site**:
   - Verify search functionality
   - Test map view
   - Check favorites (localStorage)
   - Test on mobile devices

2. **Monitor Vercel Dashboard**:
   - Check build logs
   - Monitor performance metrics
   - Track serverless function usage

3. **Future Improvements**:
   - Add PWA manifest for app installation
   - Implement offline support
   - Add Google Analytics
   - Set up custom domain

## Troubleshooting

### Issue: "Module not found: 'leaflet'"
- **Solution**: Restart dev server after installing dependencies
  ```bash
  npm install
  npm run dev
  ```

### Issue: Supabase queries returning no results
- **Verify**: Check `.env.local` has correct credentials
- **Check**: Supabase project is active and `quellen` table exists

### Issue: Favorites not persisting
- **Note**: Favorites use browser localStorage (not synced across devices)
- This is intentional for privacy

## Support

For issues:
1. Check Vercel docs: https://vercel.com/docs
2. Check Next.js docs: https://nextjs.org/docs
3. Check Supabase docs: https://supabase.com/docs


## Website Links Feature

✅ Event source website links now fully functional and visible on event cards
