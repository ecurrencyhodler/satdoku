import withMdkCheckout from '@moneydevkit/nextjs/next-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = withMdkCheckout({
  // Path aliases for cleaner imports
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };
    return config;
  },
});

export default nextConfig;
