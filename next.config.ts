import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ]
  },
};
export default nextConfig;
```

저장 후:
```
git add next.config.ts
git commit -m "add redirect to login"
git push origin master:main