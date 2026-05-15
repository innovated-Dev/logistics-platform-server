// utils/ip.utils.js
const normalizeIP = (ip) => {
  if (!ip) return 'unknown';
  
  // Remove IPv6 prefix from IPv4-mapped addresses
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  // Convert localhost variations
  if (ip === '::1' || ip === '::') {
    return '127.0.0.1';
  }
  
  return ip;
};

export const getIPAddress = normalizeIP;