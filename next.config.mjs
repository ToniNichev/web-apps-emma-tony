/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Unlike /_next/static and /uploads, these filenames never change
        // between deploys (WebGL.data/.wasm/.loader.js/.framework.js are
        // always the same 4 names) -- immutable caching here would let a
        // browser keep serving a stale file from a previous build forever.
        // Forcing revalidation means every load re-checks with the origin
        // (a cheap 304 if unchanged) instead of silently mixing a cached
        // file from one build with fresh files from another, which is what
        // was causing the loading bar to hang partway through on some
        // browsers after a redeploy.
        source: '/unity/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
