import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
import KitchenApp from './components/kitchen-app';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  if (user) return <KitchenApp displayName={user.displayName} />;
  return <main className="welcome"><div className="brand"><span className="brand-mark">s<span>↗</span></span> shelfday<span className="brand-dot">.</span></div>
    <span className="eyebrow">DAILY KITCHEN OPERATIONS</span>
    <h1>Run the kitchen.<br /><em>Know the numbers.</em></h1>
    <p>Stock, production, sales, and waste — connected in one daily operating loop. From the first delivery to a reconciled close.</p>
    <a className="button primary large" href={chatGPTSignInPath('/')} target="_top">Open your kitchen <span>↗</span></a>
    <div className="welcome-steps"><div><b>01 / Receive</b><span>Track quantities, costs, and batch expiry.</span></div><div><b>02 / Prepare</b><span>Turn recipe demand into a stock-backed prep plan.</span></div><div><b>03 / Reconcile</b><span>Balance every portion before service closes.</span></div></div>
    <p className="muted fine">Your kitchen starts empty. A labeled sample is available after sign-in.<br />No AI guesses. No payment setup. No food-safety certification.</p>
  </main>;
}
