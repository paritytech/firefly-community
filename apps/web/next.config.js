const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Triangle deployment
  output: 'export',
  distDir: 'dist',
  trailingSlash: true,

  // Base path when hosting under a repo subpath (e.g. GitHub Pages at /firefly-community)
  basePath: process.env.GITHUB_PAGES ? '/firefly-community' : '',

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  transpilePackages: ['@cocuyo/ui', '@cocuyo/types', '@cocuyo/network-config'],

  // Webpack config
  webpack: (config) => {
    // Ignore pino-pretty (optional peer dep of pino)
    config.externals.push('pino-pretty');
    return config;
  },

  // Note: headers() removed - X-Frame-Options: DENY conflicts with iframe hosting in Triangle
  // Security headers should be configured at the hosting layer
};

module.exports = withNextIntl(nextConfig);
