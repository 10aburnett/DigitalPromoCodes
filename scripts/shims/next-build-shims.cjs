// Minimal require hook so Node can import server-only Next modules during build-time scripts
const Module = require('module');
const realLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === 'server-only') {
    // No-op module
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