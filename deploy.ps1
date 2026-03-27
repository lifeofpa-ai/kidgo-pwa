#!/usr/bin/env pwsh
# Kidgo PWA - Automated Deployment Script

Write-Host "========================================"
Write-Host "  Kidgo PWA - Deployment Script" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""

# Check if git is installed
Write-Host "Checking for Git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed!" -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/download/win" -ForegroundColor Cyan
    exit 1
}
Write-Host "Git found!" -ForegroundColor Green
Write-Host ""

# Step 1: Initialize git
Write-Host "Step 1: Initializing Git..." -ForegroundColor Yellow
git init
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to initialize git" -ForegroundColor Red
    exit 1
}
Write-Host "Git initialized!" -ForegroundColor Green
Write-Host ""

# Step 2: Configure git user
Write-Host "Step 2: Configuring Git user..." -ForegroundColor Yellow
git config user.email "lifeofpa@gmail.com"
git config user.name "Patrick"
Write-Host "Git configured!" -ForegroundColor Green
Write-Host ""

# Step 3: Add files
Write-Host "Step 3: Adding files to git..." -ForegroundColor Yellow
git add .
Write-Host "Files added!" -ForegroundColor Green
Write-Host ""

# Step 4: Create commit
Write-Host "Step 4: Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Kidgo PWA - Event discovery app with Supabase integration"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create commit" -ForegroundColor Red
    exit 1
}
Write-Host "Commit created!" -ForegroundColor Green
Write-Host ""

# Step 5: Set main branch
Write-Host "Step 5: Setting main branch..." -ForegroundColor Yellow
git branch -M main
Write-Host "Main branch set!" -ForegroundColor Green
Write-Host ""

# Step 6: Add remote
Write-Host "Step 6: Adding GitHub remote..." -ForegroundColor Yellow
git remote add origin https://github.com/lifeofpa-ai/kidgo-pwa.git
Write-Host "Remote added!" -ForegroundColor Green
Write-Host ""

# Step 7: Push to GitHub
Write-Host "Step 7: Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "You may be prompted for GitHub authentication" -ForegroundColor Cyan
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  SUCCESS! Code pushed to GitHub" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Next steps to deploy to Vercel:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://vercel.com/new"
    Write-Host "2. Click 'Continue with GitHub'"
    Write-Host "3. Search for and select 'kidgo-pwa'"
    Write-Host "4. Add these environment variables:"
    Write-Host "   - NEXT_PUBLIC_SUPABASE_URL"
    Write-Host "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    Write-Host "5. Click 'Deploy'"
    Write-Host ""
    Write-Host "Your app will be live in 2-3 minutes!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  FAILED! Push to GitHub failed" -ForegroundColor Red
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Check your:" -ForegroundColor Yellow
    Write-Host "- Internet connection"
    Write-Host "- GitHub credentials (username/password)"
    Write-Host "- If using token: https://github.com/settings/tokens"
    Write-Host ""
    exit 1
}
