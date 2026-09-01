/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  allowedDevOrigins: ["*.daytonaproxy01.net"],
};

module.exports = nextConfig;
