/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "xlsx"],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias["@napi-rs/canvas"] = false;
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      path: false,
      stream: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
