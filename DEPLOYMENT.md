# Deployment Guide - Procedural World Engine Demo

This guide covers building and deploying the comprehensive engine demo to various static hosting platforms.

## Table of Contents

- [Build Configuration](#build-configuration)
- [Performance Targets](#performance-targets)
- [Building for Production](#building-for-production)
- [Deployment Options](#deployment-options)
  - [Netlify](#netlify)
  - [Vercel](#vercel)
  - [GitHub Pages](#github-pages)
- [Performance Verification](#performance-verification)
- [Troubleshooting](#troubleshooting)

## Build Configuration

The production build is configured in `vite.config.js` with the following optimizations:

### Code Splitting

The build automatically splits code into optimized chunks:

- **three**: Three.js library (separate chunk for better caching)
- **engine-core**: Core engine functionality (noise, RNG, hash)
- **engine-world**: World management (chunks, biomes)
- **engine-generation**: Generation algorithms (terrain, rivers, resources, structures)
- **engine-advanced**: Advanced features (LOD, worker pool, incremental generation, serialization)

### Minification

- JavaScript minified with Terser
- CSS minified automatically
- Console.log statements removed in production
- Dead code elimination enabled

### Asset Optimization

- Hashed filenames for cache busting
- Long-term caching for static assets
- Source maps generated for debugging

## Performance Targets

The demo is optimized to meet these requirements (Requirement 17.1, 17.8):

- **Initial Load**: < 3 seconds (on 3G connection)
- **Time to Interactive**: < 5 seconds
- **Bundle Size**: < 500KB gzipped (main bundle)
- **Frame Rate**: 60fps sustained during normal operation
- **Memory Usage**: < 200MB for 50 chunks

## Building for Production

### Prerequisites

```bash
# Install dependencies
npm install
```

### Build Commands

```bash
# Standard production build
npm run build:demo

# Build with bundle analysis
npm run build:analyze

# Preview production build locally
npm run preview
```

### Build Output

The build creates a `dist-demo` directory with:

```
dist-demo/
├── index.html              # Main HTML file
├── assets/
│   ├── index-[hash].js     # Main application bundle
│   ├── three-[hash].js     # Three.js library
│   ├── engine-core-[hash].js
│   ├── engine-world-[hash].js
│   ├── engine-generation-[hash].js
│   ├── engine-advanced-[hash].js
│   └── index-[hash].css    # Styles
└── worker.js               # Web Worker script
```

### Verify Build Size

```bash
# Check gzipped sizes
cd dist-demo
find . -name "*.js" -exec gzip -c {} \; | wc -c
```

Expected sizes:
- Main bundle: ~150-200KB gzipped
- Three.js: ~150-180KB gzipped
- Engine chunks: ~100-150KB gzipped total
- Total: ~400-530KB gzipped

## Deployment Options

### Netlify

#### Automatic Deployment

1. **Connect Repository**
   - Go to [Netlify](https://app.netlify.com/)
   - Click "Add new site" → "Import an existing project"
   - Connect your Git repository

2. **Configure Build Settings**
   - Build command: `npm run build:demo`
   - Publish directory: `dist-demo`
   - Node version: 18

3. **Deploy**
   - Netlify will automatically build and deploy on every push to main branch

#### Manual Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the demo
npm run build:demo

# Deploy to Netlify
netlify deploy --prod --dir=dist-demo
```

#### Configuration

The `netlify.toml` file includes:
- Build settings
- Security headers
- CORS headers for Web Workers
- Cache control policies
- Lighthouse performance checks

### Vercel

#### Automatic Deployment

1. **Connect Repository**
   - Go to [Vercel](https://vercel.com/)
   - Click "Add New" → "Project"
   - Import your Git repository

2. **Configure Project**
   - Framework Preset: Other
   - Build Command: `npm run build:demo`
   - Output Directory: `dist-demo`

3. **Deploy**
   - Vercel will automatically build and deploy on every push

#### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Build the demo
npm run build:demo

# Deploy to Vercel
vercel --prod
```

#### Configuration

The `vercel.json` file includes:
- Build settings
- Security headers
- CORS configuration
- Routing rules

### GitHub Pages

#### Automatic Deployment

1. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: GitHub Actions

2. **Push to Main Branch**
   - The workflow in `.github/workflows/deploy-demo.yml` will automatically:
     - Build the demo
     - Deploy to GitHub Pages

3. **Access Demo**
   - URL: `https://[username].github.io/[repository]/`

#### Manual Deployment

```bash
# Build the demo
npm run build:demo

# Install gh-pages
npm install -g gh-pages

# Deploy to gh-pages branch
gh-pages -d dist-demo
```

#### Configuration

Update `vite.config.js` base path for GitHub Pages:

```javascript
export default defineConfig({
  base: '/[repository-name]/',
  // ... rest of config
});
```

## Performance Verification

### Lighthouse Audit

Run Lighthouse to verify performance targets:

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit on deployed site
lighthouse https://your-demo-url.com --view
```

**Target Scores:**
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 90

### Bundle Analysis

Analyze bundle composition:

```bash
# Build with analysis
npm run build:analyze

# This will generate a visualization of bundle contents
```

### Load Time Testing

Test on different connection speeds:

1. Open Chrome DevTools
2. Go to Network tab
3. Set throttling to "Fast 3G"
4. Reload page and measure:
   - Initial load time
   - Time to interactive
   - First contentful paint

### Memory Profiling

Monitor memory usage:

1. Open Chrome DevTools
2. Go to Memory tab
3. Take heap snapshot after loading 50 chunks
4. Verify total memory < 200MB

### Frame Rate Monitoring

Verify 60fps performance:

1. Open Chrome DevTools
2. Go to Performance tab
3. Record while navigating the world
4. Check frame rate stays above 60fps

## Troubleshooting

### Build Fails

**Issue**: Build fails with "out of memory" error

**Solution**:
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run build:demo
```

### Bundle Too Large

**Issue**: Bundle exceeds 500KB gzipped

**Solution**:
1. Check bundle analysis: `npm run build:analyze`
2. Identify large dependencies
3. Consider lazy loading non-critical features
4. Review code splitting configuration

### Web Workers Not Loading

**Issue**: Workers fail to load in production

**Solution**:
1. Verify CORS headers are set correctly
2. Check worker script path in build output
3. Ensure HTTPS is enabled (required for SharedArrayBuffer)
4. Verify Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy headers

### Slow Initial Load

**Issue**: Initial load exceeds 3 seconds

**Solution**:
1. Enable CDN for static assets
2. Verify gzip/brotli compression is enabled
3. Check network waterfall in DevTools
4. Consider preloading critical resources
5. Optimize Three.js imports (use tree-shaking)

### Low Frame Rate

**Issue**: Frame rate drops below 60fps

**Solution**:
1. Enable LOD system
2. Reduce chunk load radius
3. Enable worker pool for parallel generation
4. Check for memory leaks in DevTools
5. Optimize mesh generation (reduce vertex count)

### Memory Leaks

**Issue**: Memory usage grows over time

**Solution**:
1. Verify chunks are properly disposed when unloaded
2. Check Three.js geometries and materials are disposed
3. Clear worker pool when not in use
4. Monitor cache size and implement eviction

## Post-Deployment Checklist

- [ ] Verify demo loads in < 3 seconds on 3G
- [ ] Confirm time to interactive < 5 seconds
- [ ] Check bundle size < 500KB gzipped
- [ ] Test 60fps frame rate during navigation
- [ ] Verify memory usage < 200MB for 50 chunks
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile devices (iOS, Android)
- [ ] Verify Web Workers function correctly
- [ ] Check all features work (LOD, worker pool, incremental generation)
- [ ] Test save/load functionality
- [ ] Verify terrain editing works
- [ ] Check all presets load correctly
- [ ] Test responsive layout on different screen sizes
- [ ] Verify error handling displays user-friendly messages
- [ ] Check help modal and documentation links
- [ ] Test shareable URLs with configuration parameters

## Monitoring

### Analytics

Consider adding analytics to track:
- Page load times
- User interactions
- Feature usage
- Error rates
- Browser/device distribution

### Error Tracking

Implement error tracking service (e.g., Sentry) to monitor:
- JavaScript errors
- WebGL errors
- Worker failures
- Generation failures

### Performance Monitoring

Use Real User Monitoring (RUM) to track:
- Core Web Vitals (LCP, FID, CLS)
- Time to Interactive
- Frame rate
- Memory usage

## Support

For deployment issues:
1. Check this guide's troubleshooting section
2. Review build logs for errors
3. Test locally with `npm run preview`
4. Check browser console for errors
5. Verify hosting platform configuration

## Additional Resources

- [Vite Build Documentation](https://vitejs.dev/guide/build.html)
- [Three.js Performance Tips](https://threejs.org/docs/#manual/en/introduction/Performance-tips)
- [Web.dev Performance Guide](https://web.dev/performance/)
- [Netlify Documentation](https://docs.netlify.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
