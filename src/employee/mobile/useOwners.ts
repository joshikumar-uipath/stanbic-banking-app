// Re-render when an Operations case is claimed or released on this device.
import { useEffect, useState } from 'react';

export function useOwners(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV((x) => x + 1);
    window.addEventListener('aof-ops-owner', on);
    return () => window.removeEventListener('aof-ops-owner', on);
  }, []);
  return v;
}
