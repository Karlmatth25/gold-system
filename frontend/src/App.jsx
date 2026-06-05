import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://gold-system-api.onrender.com';
const REFRESH_INTERVAL = 5 * 60 * 1000;

// ── styles inline pour éviter styled-components ──────────────
const css = {
  app: { maxWidth: 1300, margin: '0 auto', padding: '20px 16px' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', marginBottom: 18,
    background: '#111115', border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 4, position: 'relative', overflow: 'hidden',
  },
  navLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    background: 'linear-gradient(90deg,transparent,#C9A84C,transparent)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: {
    width: 34, height: 34, border: '1px solid #C9A84C', borderRadius: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#C9A84C', fontWeight: 700,
  },
  navRight: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  tabs: {
    display: 'flex', gap: 4, background: '#111115',
    border: '1px solid rgba(201,168,76,0.12)', borderRadius: 4,
    padding: 4, marginBottom: 18, overflowX: 'auto',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 },
  card: {
    background: '#111115', border: '1px solid rgba(201,168,76,0.1)',
    borderRadius: 4, padding: 16, position: 'relative', overflow: 'hidden',
  },
  cardBar: (color) => ({
    position: 'absolute', top: 0, left: 0, width: 3, height: '100%',
    background: color, borderRadius: '2px 0 0 2px',
  }),
  cardLabel: {
    fontFamily: 'Space Mono, monospace', fontSize: 10,
    color: '#45433e', letterSpacing: '.12em', textTransform: 'uppercase',
    marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,0.08)',
  },
};

// ── helpers ──────────────────────────────────────────────────
function mono(text, color, size = 12) {
  return <span style={{ fontFamily: 'Space Mono, monospace', fontSize: size, color }}>{text}</span>;
}

function badge(text, bg, color, border) {
  return (
    <span style={{
      fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
      padding: '3px 9px', borderRadius: 2, letterSpacing: '.07em',
      background: bg, color, border: `1px solid ${border}`,
    }}>{text}</span>
  );
}

function useUTCClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setT(`${String(n.getUTCHours()).padStart(2,'0')}:${String(n.getUTCMinutes()).padStart(2,'0')}:${String(n.getUTCSeconds()).padStart(2,'0')} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

// ── INSTRUMENT ROW ────────────────────────────────────────────
function InstrRow({ label, sub, ico, icoBg, icoColor, data, isLong, isShort, loading }) {
  if (loading) return (
    <div style={{ ...css.row, gap: 0 }}>
      <div style={{ height: 12, width: 100, background: '#1f1f28', borderRadius: 2 }} />
      <div style={{ height: 12, width: 60, background: '#1f1f28', borderRadius: 2 }} />
    </div>
  );
  if (!data || data.error) return (
    <div style={css.row}>
      <span style={{ fontSize: 12, color: '#8a8578' }}>{label}</span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#ef4444' }}>
        {data?.error || 'N/D'}
      </span>
    </div>
  );

  const up = data.change_pct >= 0;
  return (
    <div style={{ ...css.row, gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 2, background: icoBg, color: icoColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700,
        }}>{ico}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 10, color: '#45433e', marginTop: 1 }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700 }}>
            {data.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: up ? '#22c55e' : '#ef4444' }}>
            {up ? '+' : ''}{data.change_pct?.toFixed(2)}%
          </div>
          {data.ma && (
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#45433e' }}>
              MA{data.ma_period}: {data.ma?.toFixed(2)}
            </div>
          )}
        </div>
        <div style={{
          fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
          padding: '3px 8px', borderRadius: 2, minWidth: 62, textAlign: 'center',
          background: isLong ? 'rgba(34,197,94,0.1)' : isShort ? 'rgba(239,68,68,0.1)' : '#1f1f28',
          border: `1px solid ${isLong ? '#22c55e' : isShort ? '#ef4444' : 'rgba(201,168,76,0.1)'}`,
          color: isLong ? '#22c55e' : isShort ? '#ef4444' : '#45433e',
        }}>
          {isLong ? '▲ LONG' : isShort ? '▼ SHORT' : '—'}
        </div>
      </div>
    </div>
  );
}

// ── SESSION CARD ──────────────────────────────────────────────
function SessCard({ name, time, active }) {
  return (
    <div style={{
      background: active ? 'rgba(201,168,76,0.08)' : '#18181d',
      border: `1px solid ${active ? '#C9A84C' : 'rgba(201,168,76,0.1)'}`,
      borderRadius: 4, padding: '10px 8px', textAlign: 'center', transition: '.2s',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: active ? '#C9A84C' : '#8a8578' }}>{name}</div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#45433e', marginTop: 2 }}>{time}</div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700, marginTop: 5, color: active ? '#C9A84C' : '#45433e' }}>
        {active ? 'ACTIVE' : 'CLOSED'}
      </div>
    </div>
  );
}

// ── STEP ─────────────────────────────────────────────────────
function PlanStep({ num, title, desc, color }) {
  const colors = {
    green: { bg: 'rgba(34,197,94,0.1)', border: '#22c55e', text: '#22c55e' },
    red:   { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', text: '#ef4444' },
    blue:  { bg: 'rgba(96,165,250,0.1)', border: '#60a5fa', text: '#60a5fa' },
    orange:{ bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', text: '#f59e0b' },
  }[color] || { bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', text: '#f59e0b' };

  return (
    <div style={{ display: 'flex', gap: 14, padding: '11px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 2, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700, marginTop: 2,
        background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
      }}>{num}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#8a8578', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: desc }} />
      </div>
    </div>
  );
}

// ── RISK ROW ─────────────────────────────────────────────────
function RRow({ k, v, vc }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <span style={{ fontSize: 12, color: '#8a8578', fontWeight: 600 }}>{k}</span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, fontWeight: 700, color: vc || '#8a8578' }}>{v}</span>
    </div>
  );
}

// ── GLOS ITEM ─────────────────────────────────────────────────
function GItem({ term, def, role }) {
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', marginBottom: 4 }}>{term}</div>
      <div style={{ fontSize: 12, color: '#8a8578', lineHeight: 1.6 }}>{def}</div>
      {role && <div style={{ fontSize: 11, color: '#45433e', marginTop: 3, fontStyle: 'italic' }}>{role}</div>}
    </div>
  );
}

// ── PLAN LONG ─────────────────────────────────────────────────
function PlanLong() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={css.card}>
        <div style={css.cardBar('#22c55e')} />
        <div style={css.cardLabel}>Plan d'entrée Long — 5 étapes</div>
        <PlanStep num="1" color="green" title="Macro Long ≥3/4 — automatique"
          desc="DXY Bear + TLT Fall + VIX &gt;20 + SPX Bear. Le dashboard lit les données en temps réel. Si &lt;3/4 → aucun Long ce jour." />
        <PlanStep num="2" color="blue" title="Session active"
          desc="London 09h-18h ou NY 15h-23h heure française. Priorité absolue : Overlap 15h-18h. Vérifier le badge session." />
        <PlanStep num="3" color="green" title="Zone Demand verte non grise"
          desc="Prix dans ou proche d'une zone verte sur TradingView. Zone grise = morte, ignorer complètement." />
        <PlanStep num="4" color="green" title="SSL chassée — déclencheur"
          desc="Label <strong>SSL✂</strong> apparaît. Prix perce les equal lows puis revient. Piège institutionnel — le vrai mouvement monte après la chasse." />
        <PlanStep num="5" color="green" title="Volume spike vert → ENTRÉE"
          desc="Bougie verte colorée vif, volume &gt;1.5× MA. <strong>Entrer à la clôture de cette bougie uniquement.</strong>" />
        <PlanStep num="+" color="orange" title="RSI Div↑ — bonus A+"
          desc="Si DIV↑ présent → trade A+. Absent → trade B. Zone + SSL + Volume suffisent pour entrer." />
      </div>
      <div>
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={css.cardBar('#22c55e')} />
          <div style={css.cardLabel}>Gestion trade Long</div>
          <RRow k="Prix d'entrée" v="Clôture bougie vol. vert" />
          <RRow k="Stop Loss" v="Bas SSL − 1.5× ATR" vc="#ef4444" />
          <RRow k="Take Profit" v="Entrée + (dist.SL × 2)" vc="#22c55e" />
          <RRow k="Breakeven" v="SL → entrée dès TP1" vc="#60a5fa" />
          <RRow k="Risque / trade" v="1 – 2% du capital" vc="#C9A84C" />
          <RRow k="RR minimum" v="2:1" vc="#C9A84C" />
        </div>
        <div style={css.card}>
          <div style={css.cardBar('#ef4444')} />
          <div style={css.cardLabel}>Invalidations Long</div>
          <RRow k="Zone verte → grise" v="Zone morte" />
          <RRow k="Macro &lt;3/4 Long" v="Biais perdu" />
          <RRow k="Session fermée" v="Attendre ouverture" />
          <RRow k="2 pertes / jour" v="Arrêt immédiat" />
        </div>
      </div>
    </div>
  );
}

// ── PLAN SHORT ────────────────────────────────────────────────
function PlanShort() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={css.card}>
        <div style={css.cardBar('#ef4444')} />
        <div style={css.cardLabel}>Plan d'entrée Short — 5 étapes</div>
        <PlanStep num="1" color="red" title="Macro Short ≥3/4 — automatique"
          desc="DXY Bull + TLT Rise + VIX &lt;20 + SPX Bull. Dashboard en temps réel. Si &lt;3/4 → aucun Short ce jour." />
        <PlanStep num="2" color="blue" title="Session active"
          desc="London 09h-18h ou NY 15h-23h. Overlap 15h-18h = fenêtre prioritaire absolue." />
        <PlanStep num="3" color="red" title="Zone Supply rouge non grise"
          desc="Prix dans ou proche d'une zone rouge. Zone grise = invalide, jamais trader." />
        <PlanStep num="4" color="red" title="BSL chassée — déclencheur"
          desc="Label <strong>BSL✂</strong> apparaît. Prix perce les equal highs puis revient. Piège haussier — le vrai mouvement descend après." />
        <PlanStep num="5" color="red" title="Volume spike rouge → ENTRÉE"
          desc="Bougie rouge colorée vif, volume &gt;1.5× MA. <strong>Entrer à la clôture uniquement.</strong>" />
        <PlanStep num="+" color="orange" title="RSI Div↓ — bonus A+"
          desc="Si DIV↓ présent → trade A+. Absent → trade B. Zone + BSL + Volume suffisent." />
      </div>
      <div>
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={css.cardBar('#ef4444')} />
          <div style={css.cardLabel}>Gestion trade Short</div>
          <RRow k="Prix d'entrée" v="Clôture bougie vol. rouge" />
          <RRow k="Stop Loss" v="Haut BSL + 1.5× ATR" vc="#ef4444" />
          <RRow k="Take Profit" v="Entrée − (dist.SL × 2)" vc="#22c55e" />
          <RRow k="Breakeven" v="SL → entrée dès TP1" vc="#60a5fa" />
          <RRow k="Risque / trade" v="1 – 2% du capital" vc="#C9A84C" />
          <RRow k="RR minimum" v="2:1" vc="#C9A84C" />
        </div>
        <div style={css.card}>
          <div style={css.cardBar('#ef4444')} />
          <div style={css.cardLabel}>Invalidations Short</div>
          <RRow k="Zone rouge → grise" v="Zone morte" />
          <RRow k="Macro &lt;3/4 Short" v="Biais perdu" />
          <RRow k="Session fermée" v="Attendre ouverture" />
          <RRow k="2 pertes / jour" v="Arrêt immédiat" />
        </div>
      </div>
    </div>
  );
}

// ── GLOSSAIRE ─────────────────────────────────────────────────
function Glossaire() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={css.card}>
        <div style={css.cardBar('#C9A84C')} />
        <div style={css.cardLabel}>Indicateurs macro</div>
        <GItem term="DXY — Dollar Index" def="Mesure la force du dollar US contre 6 devises majeures (EUR, JPY, GBP, CAD, SEK, CHF)." role="Corrélation INVERSE Gold. DXY↑ = pression baissière Gold." />
        <GItem term="TLT — Obligations US 20 ans" def="ETF proxy des taux d'intérêt réels américains. TLT monte = taux baissent." role="TLT↑ = taux réels↓ = Gold attractif comme valeur refuge." />
        <GItem term="VIX — Indice de la peur" def="Volatilité implicite du S&P 500. Seuil critique : 20. Au-dessus = panique." role="VIX > 20 = Risk-Off = achat Gold refuge." />
        <GItem term="SPX — S&P 500" def="Indice des 500 plus grandes capitalisations américaines. Baromètre du risque global." role="SPX↓ = risk-off = rotation vers Gold." />
        <GItem term="MA20 / MA50" def="Moyenne Mobile 20 ou 50 périodes. Moyenne des N derniers prix de clôture." role="Référence directionnelle pour chaque filtre macro." />
        <GItem term="ATR" def="Average True Range — volatilité moyenne sur 14 périodes." role="Calibre le Stop Loss automatiquement dans Pine Script." />
      </div>
      <div>
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={css.cardBar('#60a5fa')} />
          <div style={css.cardLabel}>Zones & Liquidité</div>
          <GItem term="Supply Zone (rouge)" def="Zone de vente institutionnelle passée. Créée par un pivot high." role="Plafond potentiel. Point d'entrée SHORT si conditions réunies." />
          <GItem term="Demand Zone (verte)" def="Zone d'achat institutionnel passé. Créée par un pivot low." role="Plancher potentiel. Point d'entrée LONG si conditions réunies." />
          <GItem term="BSL — Buy-Side Liquidity" def="Stops d'achat placés au-dessus des equal highs par les vendeurs à découvert." role="BSL✂ = piège haussier institutionnel → Short après." />
          <GItem term="SSL — Sell-Side Liquidity" def="Stops de vente placés sous les equal lows par les acheteurs." role="SSL✂ = piège baissier institutionnel → Long après." />
        </div>
        <div style={css.card}>
          <div style={css.cardBar('#f59e0b')} />
          <div style={css.cardLabel}>Signaux techniques</div>
          <GItem term="RSI Divergence haussière DIV↑" def="Prix fait un plus bas mais RSI fait un plus haut. Faiblesse des vendeurs." role="Bonus confirmation Long. Trade B devient A+." />
          <GItem term="RSI Divergence baissière DIV↓" def="Prix fait un plus haut mais RSI fait un plus bas. Faiblesse des acheteurs." role="Bonus confirmation Short. Trade B devient A+." />
          <GItem term="Volume Spike" def="Volume bougie > 1.5× MA20. Décision institutionnelle en cours." role="Condition d'entrée obligatoire dans le système." />
          <GItem term="RR 2:1" def="Risk/Reward. Pour 1$ risqué, on vise 2$ de gain. TP = dist.SL × 2." role="Rentable dès 34% de winrate avec ce ratio." />
        </div>
      </div>
    </div>
  );
}

// ── DISCIPLINE ────────────────────────────────────────────────
function Discipline() {
  const rules = [
    ['Macro ≥3/4 obligatoire.', 'Dashboard automatisé. Biais neutre → journée observation, zéro trade.'],
    ['Session obligatoire.', 'Asie = interdit. Badge session affiché en temps réel sur le dashboard.'],
    ['Zone grise = morte.', 'Ne jamais trader une zone grise sur TradingView. Elle n\'a plus de valeur.'],
    ['3 conditions minimum.', 'Zone + liquidité + volume. RSI Divergence = bonus uniquement, pas un bloquant.'],
    ['Clôture de bougie uniquement.', 'Bougie non clôturée peut se retourner. Attendre toujours la clôture.'],
    ['Maximum 2 trades / jour.', 'Après 2 pertes consécutives → arrêt immédiat de la journée.'],
    ['Risque 1–2% du capital.', 'Avec RR 2:1, système rentable dès 34% de winrate sur le long terme.'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={css.card}>
        <div style={css.cardBar('#ef4444')} />
        <div style={css.cardLabel}>7 règles non négociables</div>
        {rules.map(([title, desc], i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(201,168,76,0.08)', alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, borderRadius: 2, flexShrink: 0,
              background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
            }}>{i + 1}</div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e4d8' }}>{title}</span>
              <span style={{ fontSize: 12, color: '#8a8578' }}> {desc}</span>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={css.cardBar('#C9A84C')} />
          <div style={css.cardLabel}>Grille de qualité des setups</div>
          {[
            ['Trade A+', 'Zone + SSL/BSL + Volume + RSI Div', '4/4', '#22c55e'],
            ['Trade B',  'Zone + SSL/BSL + Volume (sans RSI)', '3/4', '#60a5fa'],
            ['Attendre', '2/4 — setup en formation', '2/4', '#f59e0b'],
            ['Ignorer',  'Macro neutre ou <2 conditions', '0-1/4', '#ef4444'],
          ].map(([label, desc, score, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
                <div style={{ fontSize: 10, color: '#45433e', marginTop: 2 }}>{desc}</div>
              </div>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700, color }}>{score}</span>
            </div>
          ))}
        </div>
        <div style={css.card}>
          <div style={css.cardBar('#C9A84C')} />
          <div style={css.cardLabel}>Mathématiques du système</div>
          <RRow k="Breakeven winrate (RR 2:1)" v="34%" vc="#C9A84C" />
          <RRow k="2 pertes × 2% risque" v="−4% drawdown" vc="#ef4444" />
          <RRow k="1 win × 2% risque" v="+4% gain" vc="#22c55e" />
          <RRow k="Session prioritaire" v="Overlap 15h-18h" vc="#C9A84C" />
          <RRow k="Refresh données" v="Toutes les 5 min" vc="#45433e" />
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function GoldSystemApp() {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [countdown, setCountdown] = useState(300);
  const nextFetchRef = useRef(Date.now() + REFRESH_INTERVAL);
  const clock = useUTCClock();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/macro`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetch(new Date().toLocaleTimeString('fr-FR'));
      nextFetchRef.current = Date.now() + REFRESH_INTERVAL;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const auto = setInterval(fetchData, REFRESH_INTERVAL);
    const tick = setInterval(() => {
      const s = Math.max(0, Math.round((nextFetchRef.current - Date.now()) / 1000));
      setCountdown(s);
    }, 1000);
    return () => { clearInterval(auto); clearInterval(tick); };
  }, [fetchData]);

  const sess = data?.session;
  const instr = data?.instruments;
  const isLong = data?.bias === 'LONG';
  const isShort = data?.bias === 'SHORT';
  const isPartial = !isLong && !isShort && ((data?.long_score || 0) + (data?.short_score || 0)) > 0;

  const tabs = [
    ['dashboard', 'Dashboard'],
    ['long', 'Plan Long'],
    ['short', 'Plan Short'],
    ['glossaire', 'Glossaire'],
    ['discipline', 'Discipline'],
  ];

  return (
    <div style={css.app}>
      {/* NAV */}
      <nav style={css.nav}>
        <div style={css.navLine} />
        <div style={css.brand}>
          <div style={css.logo}>Au</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.06em' }}>
              GOLD SYSTEM <span style={{ color: '#C9A84C' }}>v5</span>
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#45433e', letterSpacing: '.1em', marginTop: 2 }}>
              XAU/USD · H1 · INTRADAY · DONNÉES AUTOMATISÉES
            </div>
          </div>
        </div>
        <div style={css.navRight}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#8a8578' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
              background: error ? '#ef4444' : loading ? '#f59e0b' : '#22c55e',
              animation: 'pulse 2s infinite',
            }} />
            {error ? 'ERREUR API' : loading ? 'SYNC...' : `MAJ: ${lastFetch} · refresh: ${countdown}s`}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#C9A84C', letterSpacing: '.1em' }}>{clock}</div>
          <div style={{
            fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
            padding: '4px 10px', borderRadius: 2, letterSpacing: '.08em',
            background: sess?.overlap ? 'rgba(245,158,11,0.1)' : sess?.active ? 'rgba(96,165,250,0.1)' : '#18181d',
            border: `1px solid ${sess?.overlap ? '#f59e0b' : sess?.active ? '#60a5fa' : 'rgba(201,168,76,0.1)'}`,
            color: sess?.overlap ? '#f59e0b' : sess?.active ? '#60a5fa' : '#45433e',
          }}>
            {loading ? '...' : (sess?.name || 'CHARGEMENT')}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              fontFamily: 'Space Mono, monospace', fontSize: 10, padding: '4px 10px',
              borderRadius: 2, border: '1px solid rgba(201,168,76,0.28)',
              background: 'transparent', color: '#C9A84C', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .4 : 1, transition: '.15s',
            }}
          >{loading ? '...' : '↻ REFRESH'}</button>
        </div>
      </nav>

      {/* TABS */}
      <div style={css.tabs}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, minWidth: 'fit-content', padding: '8px 14px',
              background: tab === id ? '#1f1f28' : 'transparent',
              border: tab === id ? '1px solid rgba(201,168,76,0.28)' : '1px solid transparent',
              borderRadius: 2, color: tab === id ? '#C9A84C' : '#45433e',
              fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: tab === id ? 700 : 400,
              letterSpacing: '.06em', cursor: 'pointer', whiteSpace: 'nowrap', transition: '.15s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ─── DASHBOARD ───────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444',
              borderRadius: 4, padding: 14, marginBottom: 12,
              fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#ef4444',
            }}>
              ⚠ Impossible de joindre l'API : {error}
              <br /><span style={{ color: '#8a8578', fontSize: 10 }}>
                Vérifiez que le backend Render est démarré. URL configurée : {API}
              </span>
            </div>
          )}

          {/* ROW 1 — Sessions + Biais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <div style={css.card}>
              <div style={css.cardBar('#C9A84C')} />
              <div style={css.cardLabel}>Sessions <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#45433e' }}>{clock}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <SessCard name="LONDON" time="07h–16h UTC" active={sess?.london} />
                <SessCard name="OVERLAP" time="13h–16h UTC" active={sess?.overlap} />
                <SessCard name="NEW YORK" time="13h–21h UTC" active={sess?.ny} />
              </div>
            </div>
            <div style={css.card}>
              <div style={css.cardBar('#C9A84C')} />
              <div style={css.cardLabel}>Biais macro — automatique temps réel</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'LONG', score: data?.long_score || 0, active: isLong, color: '#22c55e' },
                  { label: 'SHORT', score: data?.short_score || 0, active: isShort, color: '#ef4444' },
                ].map(({ label, score, active, color }) => (
                  <div key={label} style={{
                    background: '#18181d', borderRadius: 4, padding: 14, textAlign: 'center',
                    border: `1px solid ${active && !loading ? color : 'rgba(201,168,76,0.1)'}`,
                    transition: '.3s',
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '.08em', color: active && !loading ? color : '#45433e', marginBottom: 4 }}>
                      {label}
                    </div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#8a8578' }}>
                      {loading ? '–/4 filtres' : `${score}/4 filtres`}
                    </div>
                    <div style={{ height: 4, background: '#1f1f28', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2, transition: 'width .6s ease',
                        width: loading ? '0%' : `${(score / 4) * 100}%`,
                        background: active ? color : '#45433e',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 2 — Instruments + Corrélations */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={css.card}>
              <div style={css.cardBar('#C9A84C')} />
              <div style={css.cardLabel}>
                Instruments macro — Twelve Data (15min délai)
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#45433e' }}>
                  {instr?.gold?.price ? `XAU/USD ${instr.gold.price.toLocaleString('fr-FR')}` : ''}
                </span>
              </div>
              <InstrRow label="DXY" sub="Dollar Index vs MA20" ico="$" icoBg="rgba(96,165,250,0.1)" icoColor="#60a5fa"
                data={instr?.dxy} loading={loading}
                isLong={instr?.dxy?.trend === 'bear'} isShort={instr?.dxy?.trend === 'bull'} />
              <InstrRow label="TLT" sub="Taux réels US vs MA20" ico="%" icoBg="rgba(245,158,11,0.1)" icoColor="#f59e0b"
                data={instr?.tlt} loading={loading}
                isLong={instr?.tlt?.trend === 'bull'} isShort={instr?.tlt?.trend === 'bear'} />
              <InstrRow label="VIX" sub="Indice de la peur · seuil 20" ico="!" icoBg="rgba(239,68,68,0.1)" icoColor="#ef4444"
                data={instr?.vix} loading={loading}
                isLong={(instr?.vix?.price || 0) > 20} isShort={(instr?.vix?.price || 0) <= 20 && !!instr?.vix} />
              <InstrRow label="SPX" sub="S&P 500 vs MA50" ico="S" icoBg="rgba(34,197,94,0.1)" icoColor="#22c55e"
                data={instr?.spx} loading={loading}
                isLong={instr?.spx?.trend === 'bear'} isShort={instr?.spx?.trend === 'bull'} />
              <InstrRow label="XAU/USD" sub="Gold Spot — référence" ico="Au" icoBg="rgba(201,168,76,0.12)" icoColor="#C9A84C"
                data={instr?.gold} loading={loading}
                isLong={isLong} isShort={isShort} />
            </div>
            <div style={css.card}>
              <div style={css.cardBar('#60a5fa')} />
              <div style={css.cardLabel}>Corrélations Gold</div>
              {[
                { name: 'DXY', val: -0.85 },
                { name: 'TLT', val: +0.72 },
                { name: 'VIX', val: +0.61 },
                { name: 'SPX', val: -0.45 },
              ].map(({ name, val }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', width: 42 }}>{name}</span>
                  <div style={{ flex: 1, height: 5, background: '#1f1f28', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, position: 'absolute',
                      width: `${Math.abs(val) * 50}%`,
                      background: val < 0 ? '#ef4444' : '#22c55e',
                      right: val < 0 ? '50%' : undefined,
                      left: val > 0 ? '50%' : undefined,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700, width: 42, textAlign: 'right', color: val < 0 ? '#ef4444' : '#22c55e' }}>
                    {val > 0 ? '+' : ''}{val.toFixed(2)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(201,168,76,0.08)' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#45433e', marginBottom: 8, letterSpacing: '.1em' }}>LOGIQUE INVERSE</div>
                {[['DXY↑', 'Gold↓'], ['TLT↑', 'Gold↑'], ['VIX↑', 'Gold↑ refuge'], ['SPX↑', 'Gold↓ risk-on']].map(([a, b]) => (
                  <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, color: '#8a8578' }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', color: '#45433e' }}>{a}</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 3 — Signal + Filtres actifs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={css.card}>
              <div style={css.cardBar(isLong ? '#22c55e' : isShort ? '#ef4444' : '#C9A84C')} />
              <div style={css.cardLabel}>Signal du jour — automatique</div>
              <div style={{
                padding: 20, borderRadius: 4, textAlign: 'center', transition: '.3s',
                border: `1px solid ${isLong && !loading ? '#22c55e' : isShort && !loading ? '#ef4444' : isPartial ? '#f59e0b' : 'rgba(201,168,76,0.1)'}`,
                background: isLong && !loading ? 'rgba(34,197,94,0.08)' : isShort && !loading ? 'rgba(239,68,68,0.08)' : isPartial ? 'rgba(245,158,11,0.06)' : 'transparent',
              }}>
                <div style={{
                  fontSize: 28, fontWeight: 800, letterSpacing: '.06em', marginBottom: 8,
                  color: isLong && !loading ? '#22c55e' : isShort && !loading ? '#ef4444' : isPartial ? '#f59e0b' : '#45433e',
                }}>
                  {loading ? '...' : isLong ? 'LONG BIAS' : isShort ? 'SHORT BIAS' : isPartial ? 'PARTIEL' : 'NEUTRE'}
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#8a8578', lineHeight: 1.7 }}>
                  {loading ? 'Chargement des données...' :
                   isLong ? `${data.long_signals.join(' + ')} alignés\nNe prendre que des Longs` :
                   isShort ? `${data.short_signals.join(' + ')} alignés\nNe prendre que des Shorts` :
                   isPartial ? `${Math.max(data?.long_score || 0, data?.short_score || 0)}/4 — biais insuffisant\nJournée d'observation uniquement` :
                   'En attente de données ou biais neutre'}
                </div>
                <div style={{
                  display: 'inline-block', marginTop: 12, padding: '4px 16px', borderRadius: 2,
                  fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
                  background: isLong && !loading ? 'rgba(34,197,94,0.1)' : isShort && !loading ? 'rgba(239,68,68,0.1)' : '#1f1f28',
                  border: `1px solid ${isLong && !loading ? '#22c55e' : isShort && !loading ? '#ef4444' : 'rgba(201,168,76,0.1)'}`,
                  color: isLong && !loading ? '#22c55e' : isShort && !loading ? '#ef4444' : '#45433e',
                }}>
                  {loading ? '–/4' : `${data?.bias === 'LONG' ? data.long_score : data?.bias === 'SHORT' ? data.short_score : Math.max(data?.long_score || 0, data?.short_score || 0)}/4`}
                </div>
              </div>
            </div>

            <div style={css.card}>
              <div style={css.cardBar('#C9A84C')} />
              <div style={css.cardLabel}>Filtres macro actifs</div>
              {loading ? (
                [0, 1, 2, 3].map(i => (
                  <div key={i} style={{ ...css.row, gap: 0 }}>
                    <div style={{ height: 12, width: 80, background: '#1f1f28', borderRadius: 2 }} />
                    <div style={{ height: 12, width: 100, background: '#1f1f28', borderRadius: 2 }} />
                  </div>
                ))
              ) : [
                { label: 'DXY',  longOk: instr?.dxy?.trend === 'bear',  shortOk: instr?.dxy?.trend === 'bull',  hint: instr?.dxy ? `${instr.dxy.price?.toFixed(2)} · MA${instr.dxy.ma?.toFixed(2)}` : 'N/D' },
                { label: 'TLT',  longOk: instr?.tlt?.trend === 'bull',  shortOk: instr?.tlt?.trend === 'bear',  hint: instr?.tlt ? `${instr.tlt.price?.toFixed(2)} · MA${instr.tlt.ma?.toFixed(2)}` : 'N/D' },
                { label: 'VIX',  longOk: (instr?.vix?.price || 0) > 20, shortOk: (instr?.vix?.price || 0) <= 20 && !!instr?.vix, hint: instr?.vix ? `${instr.vix.price?.toFixed(2)} · seuil 20` : 'N/D' },
                { label: 'SPX',  longOk: instr?.spx?.trend === 'bear',  shortOk: instr?.spx?.trend === 'bull',  hint: instr?.spx ? `${instr.spx.price?.toLocaleString('fr-FR')} · MA${instr.spx.ma?.toLocaleString('fr-FR')}` : 'N/D' },
              ].map(({ label, longOk, shortOk, hint }) => (
                <div key={label} style={{ ...css.row }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#45433e', marginTop: 2 }}>{hint}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['▲ L', longOk, '#22c55e', 'rgba(34,197,94,0.1)'], ['▼ S', shortOk, '#ef4444', 'rgba(239,68,68,0.1)']].map(([txt, ok, col, bg]) => (
                      <div key={txt} style={{
                        fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 2, minWidth: 42, textAlign: 'center',
                        background: ok ? bg : '#1f1f28',
                        border: `1px solid ${ok ? col : 'rgba(201,168,76,0.1)'}`,
                        color: ok ? col : '#45433e',
                      }}>{txt}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ROW 4 — Métriques */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { val: loading ? '–' : (sess?.name || '–'), label: 'Session active', color: sess?.overlap ? '#f59e0b' : sess?.active ? '#60a5fa' : '#45433e' },
              { val: loading ? '–' : (data?.bias || 'NEUTRE'), label: 'Biais macro', color: isLong ? '#22c55e' : isShort ? '#ef4444' : '#45433e' },
              { val: loading ? '–' : `${data?.long_score || 0}/4`, label: 'Score Long', color: (data?.long_score || 0) >= 3 ? '#22c55e' : (data?.long_score || 0) >= 2 ? '#f59e0b' : '#45433e' },
              { val: loading ? '–' : `${data?.short_score || 0}/4`, label: 'Score Short', color: (data?.short_score || 0) >= 3 ? '#ef4444' : (data?.short_score || 0) >= 2 ? '#f59e0b' : '#45433e' },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ background: '#18181d', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 4, padding: 14 }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 10, color: '#45433e', marginTop: 6, letterSpacing: '.06em' }}>{label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'long' && <PlanLong />}
      {tab === 'short' && <PlanShort />}
      {tab === 'glossaire' && <Glossaire />}
      {tab === 'discipline' && <Discipline />}
    </div>
  );
}
