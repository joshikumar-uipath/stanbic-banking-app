// A new customer. The capture wizard is the customer's own flow (mode 'rm') and
// is phone-shaped already — form scan, package upload or typing — so it takes the
// whole phone, tab bar included, with its own back arrow to close it.
import AccountOpeningFlow from '../../../customer/flow';
import { useNav } from '../nav';
import { NImmersive } from '../nkit';

export default function Capture() {
  const nav = useNav();
  return (
    <NImmersive label="New customer">
      <div className="mw-full mw-capture"><AccountOpeningFlow mode="rm" onExit={nav.pop} /></div>
    </NImmersive>
  );
}
