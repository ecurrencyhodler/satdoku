import withMdkCheckout from '@moneydevkit/nextjs/next-plugin';

const nextConfig = withMdkCheckout({
  // Path aliases for cleaner imports
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname),
    };
    return config;
  },
});

export default nextConfig;
