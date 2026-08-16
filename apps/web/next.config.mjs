/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@pagevelope/editor-schema",
    "@pagevelope/email-components",
    "@pagevelope/email-renderer",
    "@pagevelope/email-qa"
  ]
};

export default nextConfig;
