# Deployment Checklist

Use this checklist to ensure the demo is properly built and ready for deployment.

## Pre-Deployment

### Build Verification

- [x] Run production build: `npm run build:demo`
- [x] Verify build output in `dist-demo/` directory
- [x] Run build verification: `npm run build:verify`
- [x] Confirm bundle sizes meet targets:
  - Total bundle: **156.58 KB gzipped** ✅ (< 500 KB target)
  - Main bundle: **29.42 KB gzipped** ✅ (< 200 KB target)
  - Three.js: **111.33 KB gzipped** ✅

### Local Testing

- [ ] Preview production build: `npm run preview`
- [ ] Test in Chrome/Edge
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Test on mobile device (responsive layout)
- [ ] Verify all features work:
  - [ ] World generation with seed
  - [ ] Parameter controls
  - [ ] Preset configurations
  - [ ] Camera controls (reset, top-down, follow terrain)
  - [ ] Visibility toggles
  - [ ] Terrain editing tools
  - [ ] Save/Load world
  - [ ] Export heightmap/biome map
  - [ ] Performance monitor displays metrics
  - [ ] LOD system (if enabled)
  - [ ] Worker pool (if enabled)
  - [ ] Incremental generation (if enabled)
  - [ ] Help modal
  - [ ] Error handling

### Performance Testing

- [ ] Run Lighthouse audit (target: > 90 for all metrics)
- [ ] Test load time on Fast 3G (target: < 3 seconds)
- [ ] Verify time to interactive (target: < 5 seconds)
- [ ] Check frame rate during navigation (target: 60fps)
- [ ] Monitor memory usage with 50 chunks (target: < 200MB)

## Deployment Options

Choose one or more deployment platforms:

### Option 1: Netlify

- [ ] Connect repository to Netlify
- [ ] Configure build settings:
  - Build command: `npm run build:demo`
  - Publish directory: `dist-demo`
  - Node version: 18
- [ ] Deploy and verify
- [ ] Test deployed site
- [ ] Check Lighthouse scores

**Quick Deploy:**
```bash
npm install -g netlify-cli
npm run build:demo
netlify deploy --prod --dir=dist-demo
```

### Option 2: Vercel

- [ ] Connect repository to Vercel
- [ ] Configure project settings:
  - Framework: Other
  - Build command: `npm run build:demo`
  - Output directory: `dist-demo`
- [ ] Deploy and verify
- [ ] Test deployed site
- [ ] Check performance metrics

**Quick Deploy:**
```bash
npm install -g vercel
npm run build:demo
vercel --prod
```

### Option 3: GitHub Pages

- [ ] Enable GitHub Pages in repository settings
- [ ] Set source to "GitHub Actions"
- [ ] Push to main branch (workflow will auto-deploy)
- [ ] Wait for deployment to complete
- [ ] Test deployed site at `https://[username].github.io/[repo]/`

**Manual Deploy:**
```bash
npm install -g gh-pages
npm run build:demo
gh-pages -d dist-demo
```

## Post-Deployment

### Verification

- [ ] Visit deployed URL
- [ ] Verify page loads correctly
- [ ] Check browser console for errors
- [ ] Test world generation
- [ ] Test all interactive features
- [ ] Verify Web Workers load correctly
- [ ] Check performance monitor updates
- [ ] Test on mobile device
- [ ] Verify responsive layout works

### Performance Validation

- [ ] Run Lighthouse on deployed site
- [ ] Confirm scores:
  - Performance: > 90
  - Accessibility: > 90
  - Best Practices: > 90
  - SEO: > 90
- [ ] Check Core Web Vitals:
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1

### Browser Compatibility

- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test in Edge (latest)
- [ ] Test on iOS Safari
- [ ] Test on Chrome Mobile (Android)

### Feature Testing

- [ ] Generate world with different seeds
- [ ] Test all presets
- [ ] Modify terrain parameters
- [ ] Toggle visibility options
- [ ] Use terrain editing tools
- [ ] Save and load world
- [ ] Export heightmap and biome map
- [ ] Test camera controls
- [ ] Verify performance metrics display
- [ ] Test LOD system
- [ ] Test worker pool
- [ ] Test incremental generation
- [ ] Open help modal
- [ ] Test error handling (invalid inputs)

### Documentation

- [ ] Update README with deployment URL
- [ ] Add deployment badge (if applicable)
- [ ] Document any deployment-specific configuration
- [ ] Update CHANGELOG with deployment information

## Troubleshooting

If issues occur during deployment, refer to [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section.

Common issues:
- **Build fails**: Check Node version (18+), run `npm ci` to clean install
- **Workers not loading**: Verify CORS headers and HTTPS enabled
- **Slow load time**: Check CDN configuration, verify compression enabled
- **Low frame rate**: Test with LOD enabled, reduce chunk load radius
- **Memory issues**: Verify chunk disposal, check for memory leaks

## Success Criteria

Deployment is successful when:

- ✅ Build completes without errors
- ✅ Bundle size < 500KB gzipped
- ✅ Site loads in < 3 seconds on 3G
- ✅ Time to interactive < 5 seconds
- ✅ Frame rate maintains 60fps
- ✅ All features work correctly
- ✅ Lighthouse scores > 90
- ✅ Works in all major browsers
- ✅ Responsive layout works on mobile
- ✅ No console errors

## Notes

- The demo uses Web Workers which require HTTPS in production
- CORS headers must be configured for worker scripts
- Source maps are included for debugging (can be removed for production)
- Compression (gzip/brotli) should be enabled on hosting platform
- CDN recommended for global distribution

---

**Last Updated**: [Current Date]
**Build Version**: Check `dist-demo/index.html` for version hash
**Deployment Status**: ✅ Ready for deployment
