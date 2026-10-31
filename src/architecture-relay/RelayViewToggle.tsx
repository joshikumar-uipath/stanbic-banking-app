import { LayoutGrid, Layers } from 'lucide-react';
import { useRelayView } from './relayView';

// Segmented Consolidated/Stacked switch for the Architecture Relay (mirrors ThemeToggle).
export function RelayViewToggle() {
  const { relayView, setRelayView } = useRelayView();
  return (
    <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/60 p-1">
      <button
        onClick={() => setRelayView('consolidated')}
        className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition ${relayView === 'consolidated' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <LayoutGrid size={15} /> Consolidated
      </button>
      <button
        onClick={() => setRelayView('stacked')}
        className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition ${relayView === 'stacked' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <Layers size={15} /> Stacked
      </button>
    </div>
  );
}
