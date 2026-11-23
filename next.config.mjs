import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

export default async function nextConfig(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
    await initOpenNextCloudflareForDev();
  }
  return {};
}
