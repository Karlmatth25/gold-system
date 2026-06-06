import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://gold-system-api.onrender.com';
const REFRESH_INTERVAL = 5 * 60 * 1000;

const T = {
  white: '#ffffff',
  w90: 'rgba(255,255,255,0.9)',
  w70: 'rgba(255,255,255,0.7)',
  w50: 'rgba(255,255,255,0.5)',
  w30: 'rgba(255,255,255,0.3)',
  w12: 'rgba(255,255,255,0.12)',
  w08: 'rgba(255,255,255,0.08)',
  w05: 'rgba(255,255,255,0.05)',
  up: '#86efac',
  down: '#fca5a5',
  upBg: 'rgba(134,239,172,0.12)',
  downBg: 'rgba(252,165,165,0.12)',
  mono: "'IBM Plex Mono', monospace",
  sans: "'Inter', sans-serif",
};

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)',
};

const css = {
  app: { maxWidth: 1280, margin: '0 auto', padding: '24px 20px 48px', position: 'relative', zIndex: 1 },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 22px', marginBottom: 20,
    ...glass, borderRadius: 20, position: 'relative', overflow: 'hidden',
  },
  navLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 14 },
  logo: {
    width: 38, height: 38,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: T.mono, fontSize: 11, color: T.white, fontWeight: 600,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  tabs: {
    display: 'flex', gap: 6, ...glass,
    borderRadius: 16, padding: 6, marginBottom: 20, overflowX: 'auto',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 },
  card: {
    ...glass, borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden',
  },
  cardBar: (color) => ({
    position: 'absolute', top: 0, left: 0, width: 2, height: '100%',
    background: color, borderRadius: '2px 0 0 2px', opacity: 0.85,
  }),
  cardLabel: {
    fontFamily: T.mono, fontSize: 10,
    color: T.w50, letterSpacing: '.14em', textTransform: 'uppercase',
    marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  divider: { borderBottom: '1px solid rgba(255,255,255,0.06)' },
  glassInner: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
};

// ── helpers ──────────────────────────────────────────────────
function mono(text, color, size = 12) {
  return <span style={{ fontFamily: T.mono, fontSize: size, color }}>{text}</span>;
}

function badge(text, bg, color, border) {
  return (
    <span style={{
      fontFamily: T.mono, fontSize: 10, fontWeight: 600,
      padding: '4px 10px', borderRadius: 8, letterSpacing: '.07em',
      background: bg, color, border: `1px solid ${border}`,
      backdropFilter: 'blur(8px)',
    }}>{text}</span>
  );
}

function instrHint(item, fmt) {
  if (!item || item.error) return 'Indisponible';
  if (item.price == null) return 'N/D';
  return fmt(item);
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
function InstrRow({ label, sub, ico, data, isLong, isShort, loading }) {
  if (loading) return (
    <div style={{ ...css.row, gap: 0 }}>
      <div className="skeleton" style={{ height: 12, width: 100 }} />
      <div className="skeleton" style={{ height: 12, width: 60 }} />
    </div>
  );
  if (!data || data.error) return (
    <div style={css.row}>
      <span style={{ fontSize: 12, color: T.w50 }}>{label}</span>
      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.down }}>
        {data?.error ? 'Erreur API' : 'N/D'}
      </span>
    </div>
  );

  const up = data.change_pct >= 0;
  return (
    <div style={{ ...css.row, gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: T.w70,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.mono, fontSize: 9, fontWeight: 600,
        }}>{ico}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.w90 }}>{label}</div>
          <div style={{ fontSize: 10, color: T.w30, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.white }}>
            {data.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: up ? T.up : T.down }}>
            {up ? '+' : ''}{data.change_pct?.toFixed(2)}%
          </div>
          {data.ma && (
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.w30 }}>
              MA{data.ma_period}: {data.ma?.toFixed(2)}
            </div>
          )}
        </div>
        <div style={{
          fontFamily: T.mono, fontSize: 10, fontWeight: 600,
          padding: '5px 10px', borderRadius: 8, minWidth: 68, textAlign: 'center',
          background: isLong ? T.upBg : isShort ? T.downBg : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isLong ? 'rgba(134,239,172,0.35)' : isShort ? 'rgba(252,165,165,0.35)' : T.w08}`,
          color: isLong ? T.up : isShort ? T.down : T.w30,
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
      ...css.glassInner,
      background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'}`,
      padding: '12px 8px', textAlign: 'center', transition: 'all 0.25s ease',
      boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: active ? T.white : T.w50 }}>{name}</div>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.w30, marginTop: 4 }}>{time}</div>
      <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 600, marginTop: 6, color: active ? T.w90 : T.w30, letterSpacing: '.1em' }}>
        {active ? '● ACTIVE' : '○ CLOSED'}
      </div>
    </div>
  );
}

// ── STEP ─────────────────────────────────────────────────────
function PlanStep({ num, title, desc, color }) {
  const colors = {
    green: { bg: T.upBg, border: 'rgba(134,239,172,0.3)', text: T.up },
    red:   { bg: T.downBg, border: 'rgba(252,165,165,0.3)', text: T.down },
    blue:  { bg: 'rgba(255,255,255,0.06)', border: T.w12, text: T.w90 },
    orange:{ bg: 'rgba(255,255,255,0.05)', border: T.w12, text: T.w70 },
  }[color] || { bg: 'rgba(255,255,255,0.05)', border: T.w12, text: T.w70 };

  return (
    <div style={{ display: 'flex', gap: 14, padding: '12px 0', ...css.divider }}>
      <div style={{
        width: 30, height: 30, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.mono, fontSize: 11, fontWeight: 600, marginTop: 2,
        background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
      }}>{num}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.w90, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: T.w50, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: desc }} />
      </div>
    </div>
  );
}

// ── RISK ROW ─────────────────────────────────────────────────
function RRow({ k, v, vc }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', ...css.divider }}>
      <span style={{ fontSize: 12, color: T.w50, fontWeight: 500 }}>{k}</span>
      <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: vc || T.w70 }}>{v}</span>
    </div>
  );
}

// ── GLOS ITEM ─────────────────────────────────────────────────
function GItem({ term, def, role }) {
  return (
    <div style={{ padding: '10px 0', ...css.divider }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.white, marginBottom: 4 }}>{term}</div>
      <div style={{ fontSize: 12, color: T.w50, lineHeight: 1.6 }}>{def}</div>
      {role && <div style={{ fontSize: 11, color: T.w30, marginTop: 4, fontStyle: 'italic' }}>{role}</div>}
    </div>
  );
}

// ── PLAN LONG ─────────────────────────────────────────────────
function PlanLong() {
  return (
    <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={css.card}>
        <div style={css.cardBar(T.up)} />
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
        <div style={{ ...css.card, marginBottom: 14 }}>
          <div style={css.cardBar(T.up)} />
          <div style={css.cardLabel}>Gestion trade Long</div>
          <RRow k="Prix d'entrée" v="Clôture bougie vol. vert" />
          <RRow k="Stop Loss" v="Bas SSL − 1.5× ATR" vc={T.down} />
          <RRow k="Take Profit" v="Entrée + (dist.SL × 2)" vc={T.up} />
          <RRow k="Breakeven" v="SL → entrée dès TP1" vc={T.w90} />
          <RRow k="Risque / trade" v="1 – 2% du capital" vc={T.white} />
          <RRow k="RR minimum" v="2:1" vc={T.white} />
        </div>
        <div style={css.card}>
          <div style={css.cardBar(T.down)} />
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
    <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={css.card}>
        <div style={css.cardBar(T.down)} />
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
        <div style={{ ...css.card, marginBottom: 14 }}>
          <div style={css.cardBar(T.down)} />
          <div style={css.cardLabel}>Gestion trade Short</div>
          <RRow k="Prix d'entrée" v="Clôture bougie vol. rouge" />
          <RRow k="Stop Loss" v="Haut BSL + 1.5× ATR" vc={T.down} />
          <RRow k="Take Profit" v="Entrée − (dist.SL × 2)" vc={T.up} />
          <RRow k="Breakeven" v="SL → entrée dès TP1" vc={T.w90} />
          <RRow k="Risque / trade" v="1 – 2% du capital" vc={T.white} />
          <RRow k="RR minimum" v="2:1" vc={T.white} />
        </div>
        <div style={css.card}>
          <div style={css.cardBar(T.down)} />
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
    <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={css.card}>
        <div style={css.cardBar(T.white)} />
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
          <div style={css.cardBar(T.w50)} />
          <div style={css.cardLabel}>Zones & Liquidité</div>
          <GItem term="Supply Zone (rouge)" def="Zone de vente institutionnelle passée. Créée par un pivot high." role="Plafond potentiel. Point d'entrée SHORT si conditions réunies." />
          <GItem term="Demand Zone (verte)" def="Zone d'achat institutionnel passé. Créée par un pivot low." role="Plancher potentiel. Point d'entrée LONG si conditions réunies." />
          <GItem term="BSL — Buy-Side Liquidity" def="Stops d'achat placés au-dessus des equal highs par les vendeurs à découvert." role="BSL✂ = piège haussier institutionnel → Short après." />
          <GItem term="SSL — Sell-Side Liquidity" def="Stops de vente placés sous les equal lows par les acheteurs." role="SSL✂ = piège baissier institutionnel → Long après." />
        </div>
        <div style={css.card}>
          <div style={css.cardBar(T.w30)} />
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
    <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={css.card}>
        <div style={css.cardBar(T.w50)} />
        <div style={css.cardLabel}>7 règles non négociables</div>
        {rules.map(([title, desc], i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', ...css.divider, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 8, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.w12}`, color: T.w70,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.mono, fontSize: 10, fontWeight: 600,
            }}>{i + 1}</div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.w90 }}>{title}</span>
              <span style={{ fontSize: 12, color: T.w50 }}> {desc}</span>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={css.cardBar(T.white)} />
          <div style={css.cardLabel}>Grille de qualité des setups</div>
          {[
            ['Trade A+', 'Zone + SSL/BSL + Volume + RSI Div', '4/4', T.up],
            ['Trade B',  'Zone + SSL/BSL + Volume (sans RSI)', '3/4', T.w90],
            ['Attendre', '2/4 — setup en formation', '2/4', T.w50],
            ['Ignorer',  'Macro neutre ou <2 conditions', '0-1/4', T.down],
          ].map(([label, desc, score, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', ...css.divider }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
                <div style={{ fontSize: 10, color: T.w30, marginTop: 2 }}>{desc}</div>
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color }}>{score}</span>
            </div>
          ))}
        </div>
        <div style={css.card}>
          <div style={css.cardBar(T.w50)} />
          <div style={css.cardLabel}>Mathématiques du système</div>
          <RRow k="Breakeven winrate (RR 2:1)" v="34%" vc={T.white} />
          <RRow k="2 pertes × 2% risque" v="−4% drawdown" vc={T.down} />
          <RRow k="1 win × 2% risque" v="+4% gain" vc={T.up} />
          <RRow k="Session prioritaire" v="Overlap 15h-18h" vc={T.w90} />
          <RRow k="Refresh données" v="Toutes les 5 min" vc={T.w30} />
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
    <div className="app-shell">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    <div style={css.app}>
      {/* NAV */}
      <nav style={css.nav}>
        <div style={css.navLine} />
        <div style={css.brand}>
          <div style={css.logo}>Au</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.04em', color: T.white }}>
              GOLD SYSTEM <span style={{ color: T.w50, fontWeight: 400 }}>v5</span>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.w30, letterSpacing: '.12em', marginTop: 3 }}>
              XAU/USD · H1 · INTRADAY · LIQUID GLASS
            </div>
          </div>
        </div>
        <div style={css.navRight}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.mono, fontSize: 10, color: T.w50 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
              background: error ? T.down : loading ? T.w50 : T.up,
              animation: 'pulse 2s infinite',
            }} />
            {error ? 'ERREUR API' : loading ? 'SYNC...' : `MAJ: ${lastFetch} · ${countdown}s`}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 13, color: T.w90, letterSpacing: '.08em' }}>{clock}</div>
          <div style={{
            fontFamily: T.mono, fontSize: 10, fontWeight: 600,
            padding: '5px 12px', borderRadius: 10, letterSpacing: '.08em',
            background: sess?.active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${sess?.active ? 'rgba(255,255,255,0.2)' : T.w08}`,
            color: sess?.active ? T.white : T.w30,
          }}>
            {loading ? '...' : (sess?.name || 'CHARGEMENT')}
          </div>
          <button
            className="glass-btn"
            onClick={fetchData}
            disabled={loading}
            style={{
              fontFamily: T.mono, fontSize: 10, padding: '6px 14px',
              borderRadius: 10, border: `1px solid ${T.w12}`,
              background: 'rgba(255,255,255,0.04)', color: T.w90,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .4 : 1,
            }}
          >{loading ? '...' : '↻ REFRESH'}</button>
        </div>
      </nav>

      {/* TABS */}
      <div style={css.tabs}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className="tab-btn"
            onClick={() => setTab(id)}
            style={{
              flex: 1, minWidth: 'fit-content', padding: '10px 16px',
              background: tab === id ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: tab === id ? `1px solid ${T.w12}` : '1px solid transparent',
              borderRadius: 12, color: tab === id ? T.white : T.w30,
              fontFamily: T.sans, fontSize: 12, fontWeight: tab === id ? 600 : 400,
              letterSpacing: '.04em', cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: tab === id ? 'inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ─── DASHBOARD ───────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <>
          {error && (
            <div style={{
              ...glass, background: T.downBg, border: '1px solid rgba(252,165,165,0.25)',
              borderRadius: 16, padding: 16, marginBottom: 14,
              fontFamily: T.mono, fontSize: 12, color: T.down,
            }}>
              ⚠ Impossible de joindre l'API : {error}
              <br /><span style={{ color: T.w50, fontSize: 10 }}>
                Vérifiez que le backend Render est démarré. URL : {API}
              </span>
            </div>
          )}

          {/* ROW 1 — Sessions + Biais */}
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 14 }}>
            <div style={css.card}>
              <div style={css.cardBar(T.white)} />
              <div style={css.cardLabel}>Sessions <span style={{ fontFamily: T.mono, fontSize: 9, color: T.w30 }}>{clock}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <SessCard name="LONDON" time="07h–16h UTC" active={sess?.london} />
                <SessCard name="OVERLAP" time="13h–16h UTC" active={sess?.overlap} />
                <SessCard name="NEW YORK" time="13h–21h UTC" active={sess?.ny} />
              </div>
            </div>
            <div style={css.card}>
              <div style={css.cardBar(T.w50)} />
              <div style={css.cardLabel}>Biais macro — automatique temps réel</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'LONG', score: data?.long_score || 0, active: isLong, color: T.up },
                  { label: 'SHORT', score: data?.short_score || 0, active: isShort, color: T.down },
                ].map(({ label, score, active, color }) => (
                  <div key={label} style={{
                    ...css.glassInner, padding: 16, textAlign: 'center',
                    border: `1px solid ${active && !loading ? (label === 'LONG' ? 'rgba(134,239,172,0.3)' : 'rgba(252,165,165,0.3)') : T.w08}`,
                    transition: 'all 0.3s ease',
                  }}>
                    <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.1em', color: active && !loading ? color : T.w30, marginBottom: 4 }}>
                      {label}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.w50 }}>
                      {loading ? '–/4 filtres' : `${score}/4 filtres`}
                    </div>
                    <div style={{ height: 3, background: T.w05, borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2, transition: 'width .6s ease',
                        width: loading ? '0%' : `${(score / 4) * 100}%`,
                        background: active ? color : T.w30,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 2 — Instruments + Corrélations */}
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={css.card}>
              <div style={css.cardBar(T.white)} />
              <div style={css.cardLabel}>
                Instruments macro — Twelve Data
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.w30 }}>
                  {instr?.GOLD?.price ? `XAU/USD ${instr.GOLD.price.toLocaleString('fr-FR')}` : ''}
                </span>
              </div>
              <InstrRow label="DXY" sub="Dollar Index vs MA20" ico="$"
                data={instr?.DXY} loading={loading}
                isLong={instr?.DXY?.trend === 'bear'} isShort={instr?.DXY?.trend === 'bull'} />
              <InstrRow label="TLT" sub="Taux réels US vs MA20" ico="%"
                data={instr?.TLT} loading={loading}
                isLong={instr?.TLT?.trend === 'bull'} isShort={instr?.TLT?.trend === 'bear'} />
              <InstrRow label="VIX" sub="Indice de la peur · seuil 20" ico="!"
                data={instr?.VIX} loading={loading}
                isLong={(instr?.VIX?.price || 0) > 20} isShort={(instr?.VIX?.price || 0) <= 20 && !!instr?.VIX} />
              <InstrRow label="SPX" sub="S&P 500 vs MA50" ico="S"
                data={instr?.SPX} loading={loading}
                isLong={instr?.SPX?.trend === 'bear'} isShort={instr?.SPX?.trend === 'bull'} />
              <InstrRow label="XAU/USD" sub="Gold Spot — référence" ico="Au"
                data={instr?.GOLD} loading={loading}
                isLong={isLong} isShort={isShort} />
            </div>
            <div style={css.card}>
              <div style={css.cardBar(T.w50)} />
              <div style={css.cardLabel}>Corrélations Gold</div>
              {[
                { name: 'DXY', val: -0.85 },
                { name: 'TLT', val: +0.72 },
                { name: 'VIX', val: +0.61 },
                { name: 'SPX', val: -0.45 },
              ].map(({ name, val }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', ...css.divider }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.w70, width: 42 }}>{name}</span>
                  <div style={{ flex: 1, height: 4, background: T.w05, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, position: 'absolute',
                      width: `${Math.abs(val) * 50}%`,
                      background: val < 0 ? T.down : T.up,
                      opacity: 0.7,
                      right: val < 0 ? '50%' : undefined,
                      left: val > 0 ? '50%' : undefined,
                    }} />
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, width: 42, textAlign: 'right', color: val < 0 ? T.down : T.up }}>
                    {val > 0 ? '+' : ''}{val.toFixed(2)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.w08}` }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.w30, marginBottom: 8, letterSpacing: '.12em' }}>LOGIQUE INVERSE</div>
                {[['DXY↑', 'Gold↓'], ['TLT↑', 'Gold↑'], ['VIX↑', 'Gold↑ refuge'], ['SPX↑', 'Gold↓ risk-on']].map(([a, b]) => (
                  <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: T.w50 }}>
                    <span style={{ fontFamily: T.mono, color: T.w30 }}>{a}</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 3 — Signal + Filtres actifs */}
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={css.card}>
              <div style={css.cardBar(isLong ? T.up : isShort ? T.down : T.w50)} />
              <div style={css.cardLabel}>Signal du jour — automatique</div>
              <div style={{
                ...css.glassInner, padding: 24, textAlign: 'center', transition: 'all 0.3s ease',
                border: `1px solid ${isLong && !loading ? 'rgba(134,239,172,0.25)' : isShort && !loading ? 'rgba(252,165,165,0.25)' : isPartial ? T.w12 : T.w08}`,
                background: isLong && !loading ? T.upBg : isShort && !loading ? T.downBg : 'rgba(255,255,255,0.02)',
              }}>
                <div style={{
                  fontSize: 26, fontWeight: 700, letterSpacing: '.08em', marginBottom: 10,
                  color: isLong && !loading ? T.up : isShort && !loading ? T.down : isPartial ? T.w70 : T.w30,
                }}>
                  {loading ? '...' : isLong ? 'LONG BIAS' : isShort ? 'SHORT BIAS' : isPartial ? 'PARTIEL' : 'NEUTRE'}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.w50, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {loading ? 'Chargement des données...' :
                   isLong ? `${data.long_signals.join(' + ')} alignés\nNe prendre que des Longs` :
                   isShort ? `${data.short_signals.join(' + ')} alignés\nNe prendre que des Shorts` :
                   isPartial ? `${Math.max(data?.long_score || 0, data?.short_score || 0)}/4 — biais insuffisant\nJournée d'observation uniquement` :
                   'En attente de données ou biais neutre'}
                </div>
                <div style={{
                  display: 'inline-block', marginTop: 14, padding: '6px 18px', borderRadius: 10,
                  fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: '.1em',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isLong && !loading ? 'rgba(134,239,172,0.3)' : isShort && !loading ? 'rgba(252,165,165,0.3)' : T.w08}`,
                  color: isLong && !loading ? T.up : isShort && !loading ? T.down : T.w30,
                }}>
                  {loading ? '–/4' : `${data?.bias === 'LONG' ? data.long_score : data?.bias === 'SHORT' ? data.short_score : Math.max(data?.long_score || 0, data?.short_score || 0)}/4`}
                </div>
              </div>
            </div>

            <div style={css.card}>
              <div style={css.cardBar(T.white)} />
              <div style={css.cardLabel}>Filtres macro actifs</div>
              {loading ? (
                [0, 1, 2, 3].map(i => (
                  <div key={i} style={{ ...css.row, gap: 0 }}>
                    <div className="skeleton" style={{ height: 12, width: 80 }} />
                    <div className="skeleton" style={{ height: 12, width: 100 }} />
                  </div>
                ))
              ) : [
                { label: 'DXY',  longOk: instr?.DXY?.trend === 'bear',  shortOk: instr?.DXY?.trend === 'bull',  hint: instrHint(instr?.DXY, (i) => `${i.price.toFixed(2)} · MA${i.ma?.toFixed(2)}`) },
                { label: 'TLT',  longOk: instr?.TLT?.trend === 'bull',  shortOk: instr?.TLT?.trend === 'bear',  hint: instrHint(instr?.TLT, (i) => `${i.price.toFixed(2)} · MA${i.ma?.toFixed(2)}`) },
                { label: 'VIX',  longOk: (instr?.VIX?.price || 0) > 20, shortOk: (instr?.VIX?.price || 0) <= 20 && !!instr?.VIX && !instr?.VIX?.error, hint: instrHint(instr?.VIX, (i) => `${i.price.toFixed(2)} · seuil 20`) },
                { label: 'SPX',  longOk: instr?.SPX?.trend === 'bear',  shortOk: instr?.SPX?.trend === 'bull',  hint: instrHint(instr?.SPX, (i) => `${i.price.toLocaleString('fr-FR')} · MA${i.ma?.toLocaleString('fr-FR')}`) },
              ].map(({ label, longOk, shortOk, hint }) => (
                <div key={label} style={{ ...css.row }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.w90 }}>{label}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: T.w30, marginTop: 2 }}>{hint}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['▲ L', longOk, T.up, T.upBg], ['▼ S', shortOk, T.down, T.downBg]].map(([txt, ok, col, bg]) => (
                      <div key={txt} style={{
                        fontFamily: T.mono, fontSize: 10, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 8, minWidth: 44, textAlign: 'center',
                        background: ok ? bg : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${ok ? (txt.includes('L') ? 'rgba(134,239,172,0.3)' : 'rgba(252,165,165,0.3)') : T.w08}`,
                        color: ok ? col : T.w30,
                      }}>{txt}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ROW 4 — Métriques */}
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { val: loading ? '–' : (sess?.name || '–'), label: 'Session active', color: sess?.active ? T.white : T.w30 },
              { val: loading ? '–' : (data?.bias || 'NEUTRE'), label: 'Biais macro', color: isLong ? T.up : isShort ? T.down : T.w30 },
              { val: loading ? '–' : `${data?.long_score || 0}/4`, label: 'Score Long', color: (data?.long_score || 0) >= 3 ? T.up : (data?.long_score || 0) >= 2 ? T.w70 : T.w30 },
              { val: loading ? '–' : `${data?.short_score || 0}/4`, label: 'Score Short', color: (data?.short_score || 0) >= 3 ? T.down : (data?.short_score || 0) >= 2 ? T.w70 : T.w30 },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ ...css.glassInner, padding: 16 }}>
                <div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 10, color: T.w30, marginTop: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
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
    </div>
  );
}
