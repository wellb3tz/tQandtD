# Technology Stack

## Language & Runtime

- **TypeScript 5.3+**: Strict mode enabled with comprehensive type checking
- **Target**: ES2020 for modern browser compatibility
- **Module System**: ESNext modules

## Build System

- **Vite 5.4+**: Development server and production bundling
- **TypeScript Compiler**: Library compilation to `dist/`
- **Terser**: Minification with console.log removal in production

## Testing Framework

- **Vitest 1.0+**: Unit, integration, and property-based testing
- **fast-check 3.15+**: Property-based testing for correctness validation
- **Coverage**: V8 provider with text, JSON, and HTML reports

## Key Dependencies

- **pako 2.1+**: Compression for world serialization
- **three.js 0.160+**: 3D rendering (interactive app only, peer dependency)

## Common Commands

### Development
```bash
npm run app               # Start Vite dev server on port 3000
npm run build             # Compile TypeScript library to dist/
npm run build:app         # Build interactive app to dist-app/
npm run preview           # Preview production app build
```

### Testing
```bash
npm test                  # Run all tests once (151 tests)
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
```

### Build Verification
```bash
npm run build:verify      # Verify build output integrity
npm run build:analyze     # Analyze bundle size
```

## Documentation

Comprehensive documentation in `docs/` directory:
- **README.md**: Documentation index and navigation
- **GETTING_STARTED.md**: Installation and basic usage
- **API.md**: Complete API reference
- **EXAMPLES.md**: Code examples for common tasks
- **CONFIGURATION.md**: Detailed configuration options
- **ARCHITECTURE.md**: Internal architecture and algorithms
- **ADVANCED.md**: Multi-threading, serialization, custom biomes
- **PERFORMANCE.md**: Optimization tips and benchmarks
- **MIGRATION_GUIDE.md**: Upgrading between versions
- **FAQ.md**: Frequently asked questions

## TypeScript Configuration

- **Strict Mode**: All strict checks enabled
- **No Unused**: Enforces no unused locals or parameters
- **No Implicit Returns**: All code paths must return
- **Declaration Maps**: Generated for debugging
- **Source Maps**: Enabled for both library and app

## Code Quality Standards

- No `any` types without explicit justification
- Comprehensive JSDoc comments for public APIs
- Configuration validation with clear error messages
- Error handling for invalid inputs with graceful degradation
- Deterministic behavior (same inputs → same outputs)
- Performance-conscious implementations (target <100ms per chunk)
- Memory-efficient data structures (sparse representations where applicable)
- Structured logging for debugging and production monitoring

## Performance Optimizations

### Memory Optimizations
- **Sparse biome weights**: 70% reduction in biome weight memory
- **Pre-allocated configs**: Eliminated 1000+ allocations per chunk
- **Typed arrays**: Use Float32Array, Uint8Array for compact storage

### Algorithm Optimizations
- **Circular buffer**: O(1) flood-fill operations for lake generation
- **Swap-and-pop**: O(1) removal for Poisson sampling
- **LRU cache**: O(1) access and eviction for chunk cache

### Results
- 32×32 chunk generation: ~30-50ms (no lakes), ~115ms (with lakes)
- Memory per chunk: ~7KB (56% reduction from v1.x)
- Cache hit rate: 50-70%
