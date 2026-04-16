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
- **three.js 0.160+**: 3D rendering (demo only, peer dependency)

## Common Commands

### Development
```bash
npm run demo              # Start Vite dev server on port 3000
npm run build             # Compile TypeScript library to dist/
npm run build:demo        # Build demo application to dist-demo/
npm run preview           # Preview production demo build
```

### Testing
```bash
npm test                  # Run all tests once
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
```

### Build Verification
```bash
npm run build:verify      # Verify build output integrity
npm run build:analyze     # Analyze bundle size
```

## TypeScript Configuration

- **Strict Mode**: All strict checks enabled
- **No Unused**: Enforces no unused locals or parameters
- **No Implicit Returns**: All code paths must return
- **Declaration Maps**: Generated for debugging
- **Source Maps**: Enabled for both library and demo

## Code Quality Standards

- No `any` types without explicit justification
- Comprehensive JSDoc comments for public APIs
- Error handling for invalid inputs
- Deterministic behavior (same inputs → same outputs)
- Performance-conscious implementations (target <100ms per chunk)
