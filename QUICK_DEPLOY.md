# Quick Deploy Guide

Get the demo deployed in 5 minutes or less!

## Prerequisites

- Node.js 18+ installed
- Git repository initialized
- Demo built successfully

## Step 1: Build

```bash
# Install dependencies (if not already done)
npm install

# Build the demo
npm run build:demo

# Verify build
npm run build:verify
```

Expected output:
```
✅ Build verification PASSED
🚀 Ready for deployment!
```

## Step 2: Choose Platform

### Option A: Netlify (Recommended)

**Fastest deployment with automatic builds:**

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your Git repository
4. Settings auto-detected from `netlify.toml`:
   - Build command: `npm run build:demo`
   - Publish directory: `dist-demo`
5. Click "Deploy site"

**Done!** Your site will be live in ~2 minutes.

**Manual deploy:**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist-demo
```

### Option B: Vercel

**Great for Next.js-style deployments:**

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your Git repository
4. Settings auto-detected from `vercel.json`
5. Click "Deploy"

**Done!** Your site will be live in ~2 minutes.

**Manual deploy:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option C: GitHub Pages

**Free hosting for public repos:**

1. Go to repository Settings → Pages
2. Source: "GitHub Actions"
3. Push to main branch

**Done!** Workflow deploys automatically.

**Manual deploy:**
```bash
npm install -g gh-pages
gh-pages -d dist-demo
```

## Step 3: Verify

Visit your deployed URL and check:

- [ ] Page loads without errors
- [ ] Generate world works
- [ ] Controls are responsive
- [ ] Performance monitor updates
- [ ] No console errors

## Step 4: Performance Check

Run Lighthouse audit:

```bash
npm install -g lighthouse
lighthouse https://your-site-url.com --view
```

Target scores: All > 90

## Troubleshooting

**Build fails?**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build:demo
```

**Workers not loading?**
- Ensure HTTPS is enabled
- Check browser console for CORS errors
- Verify deployment platform supports Web Workers

**Slow load time?**
- Check if compression is enabled
- Verify CDN is active
- Test on different network speeds

## Performance Targets

Your deployed demo should meet:

- ✅ Initial load: < 3 seconds
- ✅ Time to interactive: < 5 seconds
- ✅ Bundle size: 156.58 KB gzipped
- ✅ Frame rate: 60fps
- ✅ Lighthouse: > 90 all categories

## Need Help?

- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guide
- Review [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- See [BUILD_SUMMARY.md](./BUILD_SUMMARY.md) for build details

## Success!

Once deployed, share your demo:

```
🎉 Demo deployed successfully!
📍 URL: https://your-site-url.com
📦 Bundle: 156.58 KB gzipped
⚡ Performance: Optimized
```

---

**Total Time:** ~5 minutes
**Difficulty:** Easy
**Cost:** Free (all platforms have free tiers)
