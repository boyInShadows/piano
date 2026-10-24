const nextConfig = {
  async headers() {
    return [{
      source: '/audio/piano/salamander-v1/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
};

export default nextConfig;
