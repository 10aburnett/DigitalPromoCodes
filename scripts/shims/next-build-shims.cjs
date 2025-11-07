// Minimal require hook so Node can import server-only Next modules during build-time scripts
const Module = require('module');
const realLoad = Module._load;
const realResolve = Module._resolveFilename;

// Intercept resolution to prevent tsx from ever seeing the real server-only module
Module._resolveFilename = function (request, parent, isMain) {
  if (request === 'server-only') {
    // Return this shim file itself as the "server-only" module
    return __filename;
  }
  return realResolve.apply(this, arguments);
};

Module._load = function (request, parent, isMain) {
  // Check both the request name and if it's coming from the server-only package path
  const isServerOnly = request === 'server-only' ||
                       (typeof request === 'string' && request.includes('node_modules/server-only'));

  if (isServerOnly) {
    // No-op module - return immediately without calling realLoad
    return {};
  }
  if (request === 'next/headers') {
    // Provide a minimal stub that won't crash your server-only functions
    return {
      headers: () => new Map(), // has .get()
      cookies: () => ({
        get: () => undefined,
        getAll: () => [],
        set: () => {},
        delete: () => {},
      }),
    };
  }
  if (request === 'next/navigation') {
    // In case VM imports redirect/notFound; return inert stubs
    return {
      redirect: () => { throw new Error('redirect() not supported in build guard'); },
      notFound: () => { throw new Error('notFound() not supported in build guard'); },
    };
  }
  return realLoad.apply(this, arguments);
};