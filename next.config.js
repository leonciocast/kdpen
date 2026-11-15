// One id per build: the server reports it at /api/version and each page knows the id it
// was built with, so an open tab can tell when the server has been rebuilt.
const BUILD_ID = process.env.BUILD_ID_OVERRIDE || Date.now().toString(36);

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
    generateBuildId: async () => BUILD_ID,
}

module.exports = nextConfig
