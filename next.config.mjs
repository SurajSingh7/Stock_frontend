/** @type {import('next').NextConfig} */

// ERP backend (internal-company / config master data). Lives on a different
// host than the stock backend and only whitelists https://sales.gtel.in for
// CORS, so the browser never calls it directly — requests go to the
// same-origin /erp-api path below and Next forwards them server-side.
const ERP_API_BASE = process.env.ERP_API_BASE || "https://erpbcken.gtel.in/api/v1";

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Build workers. The default (one per CPU core) runs out of memory on an
  // 8 GB machine that is also running the other apps, and the build dies with
  // exit code 3221226505. Two is slower but always finishes.
  experimental: { cpus: 2 },

  async rewrites() {
    return [
      {
        source: "/erp-api/:path*",
        destination: `${ERP_API_BASE}/:path*`,
      },
    ];
  },
};

export default nextConfig;
