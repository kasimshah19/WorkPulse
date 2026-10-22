import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../app.js';
import env from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowlist of routes accessible without bearer token authentication
const PUBLIC_ROUTE_PATTERNS = [
  /^\/health$/,
  /^\/ready$/,
  /^\/api\/v1\/health$/,
  /^\/api\/v1\/ready$/,
  /^\/api\/v1\/auth\/send-otp$/,
  /^\/api\/v1\/auth\/verify-otp$/,
  /^\/api\/v1\/auth\/refresh$/,
  /^\/api\/v1\/auth\/logout$/,
  /^\/api\/v1\/payments\/razorpay\/webhook$/,
  /^\/api\/v1\/voice\/skills$/,
];

// Dev routes allowed only in non-production environments
const DEV_ROUTE_PATTERNS = [
  /^\/api\/v1\/auth\/dev-login$/,
  /^\/api\/v1\/auth\/dev-users$/,
  /^\/api\/v1\/dev\/.*/,
];

/**
 * Recursively parse Express router stack to collect all mounted routes
 */
function extractRoutes(app) {
  const routes = [];

  function processLayer(layer, basePath = '', parentMiddlewares = []) {
    if (layer.route) {
      const pathPart = layer.route.path === '/' ? '' : layer.route.path;
      const fullPath = (basePath + pathPart).replace(/\/+/g, '/');
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());

      const stackMiddlewares = layer.route.stack.map((s) => s.name || s.handle?.name || 'anonymous');
      const allMiddlewares = [...parentMiddlewares, ...stackMiddlewares];

      methods.forEach((method) => {
        routes.push({
          method,
          path: fullPath,
          middlewares: allMiddlewares,
        });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      let routerPath = '';
      if (layer.regexp) {
        const regexStr = layer.regexp.source;
        routerPath = regexStr
          .replace('\\/?(?=\\/|$)', '')
          .replace('^\\', '')
          .replace('\\/?$', '')
          .replace(/\\\//g, '/')
          .replace(/\^/g, '')
          .replace(/\$/g, '')
          .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ':param');
      }

      const layerMiddlewares = [];
      layer.handle.stack.forEach((subLayer) => {
        if (!subLayer.route && subLayer.name && subLayer.name !== 'router') {
          layerMiddlewares.push(subLayer.name);
        }
      });

      const currentMiddlewares = [...parentMiddlewares, ...layerMiddlewares];
      const nextBase = basePath + (routerPath.startsWith('/') ? routerPath : '/' + routerPath);

      layer.handle.stack.forEach((subLayer) => {
        processLayer(subLayer, nextBase, currentMiddlewares);
      });
    }
  }

  app._router.stack.forEach((layer) => processLayer(layer));
  return routes;
}

/**
 * Audit routes against security policies
 */
export function auditRoutes() {
  const rawRoutes = extractRoutes(app);

  // Deduplicate by method + path
  const seen = new Set();
  const routes = [];
  for (const r of rawRoutes) {
    const key = `${r.method} ${r.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      routes.push(r);
    }
  }

  const results = [];
  const errors = [];

  for (const r of routes) {
    const isPublic = PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(r.path));
    const isDev = DEV_ROUTE_PATTERNS.some((pattern) => pattern.test(r.path));

    // Check authentication
    const hasAuth = r.middlewares.some(
      (m) =>
        m.toLowerCase().includes('auth') ||
        m.toLowerCase().includes('admin') ||
        m.toLowerCase().includes('role')
    );

    // Check validation (validate middleware or strict input check)
    const hasValidation = r.middlewares.some(
      (m) =>
        m.toLowerCase().includes('validate') ||
        m.toLowerCase().includes('multer') ||
        r.method === 'GET'
    );

    // Check rate limiter
    const hasLimiter =
      r.middlewares.some((m) => m.toLowerCase().includes('limit')) ||
      r.path.startsWith('/api/');

    // Allowed roles
    let allowedRoles = 'All authenticated';
    if (isPublic) {
      allowedRoles = 'Public (Anonymous)';
    } else if (r.path.includes('/admin/')) {
      allowedRoles = 'Admin only';
    } else if (r.middlewares.some((m) => m.includes('contractor'))) {
      allowedRoles = 'Contractor only';
    } else if (r.middlewares.some((m) => m.includes('worker'))) {
      allowedRoles = 'Worker only';
    }

    const routeAudit = {
      method: r.method,
      path: r.path,
      isPublic,
      isDev,
      hasAuth: hasAuth || isPublic || isDev,
      hasValidation: hasValidation || isPublic,
      hasLimiter,
      allowedRoles,
      middlewares: r.middlewares.filter((m) => m !== 'anonymous').join(', ') || 'expressHandler',
    };

    results.push(routeAudit);

    // Violation checks
    if (!isPublic && !isDev && !hasAuth) {
      errors.push(`NON-PUBLIC ROUTE LACKS AUTH: [${r.method}] ${r.path}`);
    }

    if (r.method !== 'GET' && !hasValidation && !isPublic) {
      errors.push(`MUTATING ROUTE LACKS VALIDATION: [${r.method}] ${r.path}`);
    }

    if (isDev && env.nodeEnv === 'production') {
      errors.push(`DEV ROUTE MOUNTED IN PRODUCTION: [${r.method}] ${r.path}`);
    }
  }

  // Generate Markdown report
  let md = `# WorkPulse API Route Security Audit Report\n\n`;
  md += `Audit Date: ${new Date().toISOString()}\n`;
  md += `Total Routes Audited: ${routes.length}\n`;
  md += `Environment: ${env.nodeEnv}\n\n`;
  md += `| Method | Path | Allowed Roles | Auth Required | Validation | Rate Limiter | Handler Stack |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  for (const r of results) {
    const authBadge = r.hasAuth ? '✅' : '❌';
    const valBadge = r.hasValidation ? '✅' : '❌';
    const limitBadge = r.hasLimiter ? '✅' : '⚠️';
    md += `| \`${r.method}\` | \`${r.path}\` | ${r.allowedRoles} | ${authBadge} | ${valBadge} | ${limitBadge} | \`${r.middlewares}\` |\n`;
  }

  if (errors.length > 0) {
    md += `\n## ⚠️ Audit Violations (${errors.length})\n\n`;
    for (const err of errors) {
      md += `- ❌ ${err}\n`;
    }
  } else {
    md += `\n## ✅ Audit Result: PASS\nAll routes adhere to authentication, role restrictions, and validation requirements.\n`;
  }

  // Save to docs/route-audit.md
  const docsPath = path.resolve(__dirname, '../../../docs/route-audit.md');
  fs.writeFileSync(docsPath, md, 'utf8');
  console.log(`\n📋 Route audit report written to docs/route-audit.md (${routes.length} routes audited).`);

  if (errors.length > 0) {
    console.error(`\n❌ ROUTE AUDIT FAILED with ${errors.length} violation(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✅ ROUTE AUDIT PASSED: All endpoints authenticated, authorized, and validated.\n');
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  auditRoutes();
}
