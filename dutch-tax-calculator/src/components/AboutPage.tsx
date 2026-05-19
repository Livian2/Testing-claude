import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, BarChart3, Calculator, Coins, Database, FileText, Gift,
  Home, LineChart, Lock, PieChart, Shield, Sparkles, TrendingUp, Wallet, X, Zap,
  ChevronRight, BookOpen, BarChart2,
} from 'lucide-react';
import homescreenSrc from '../assets/homescreen.png';

type Tab = 'income' | 'woon' | 'waardes' | 'expenses' | 'schulden' | 'bank' | 'portfolio' | 'afschrijvingen' | 'schenkingen' | 'jaarruimte' | 'prognose' | 'results' | 'marginale';
interface ExampleStep { label: string; value: string; accent?: boolean }
interface ModuleDetail {
  id: Tab; icon: React.ElementType; name: string; emoji: string;
  accentColor: string; tagline: string; description: string[]; inputs: string[];
  example: { scenario: string; steps: ExampleStep[]; result: string };
  formula?: string; formulaColor?: string; tip: string;
}

const MODULES: ModuleDetail[] = [
  { id:'income', icon:Wallet, name:'Inkomen', emoji:'💼', accentColor:'text-sky-400',
    tagline:'Bruto naar netto — alle Box 1 bronnen in één scherm.',
    description:['Vul je bruto inkomen in uit alle bronnen: vast dienstverband, freelance, huurinkomsten of andere Box 1 inkomsten. De tool berekent automatisch de belastingschijven en heffingskortingen.','Pensioenpremies en lijfrentepremies verlagen je belastbaar inkomen, zodat je direct ziet hoeveel minder belasting je betaalt door fiscaal gunstig te sparen.'],
    inputs:['Bruto jaarsalaris','Freelance/ZZP inkomen','Huurinkomsten','Overig Box 1','Werknemerspensioenpremie','Lijfrenteaftrek'],
    example:{ scenario:'Salariswerknemer, €65.000 bruto, pensioenpremie €5.500', steps:[{label:'Bruto inkomen',value:'€ 65.000'},{label:'− pensioenpremie',value:'− € 5.500'},{label:'Belastbaar Box 1',value:'€ 59.500'},{label:'Schijf 1 (≤€38.441)',value:'€ 13.770  (35,82%)'},{label:'Schijf 2',value:'€ 7.898  (37,48%)'},{label:'− Heffingskortingen',value:'− € 4.096'},{label:'Netto te betalen',value:'€ 17.572',accent:true}], result:'Netto jaarinkomen ≈ € 41.928 (€ 3.494 / maand)' },
    formula:'belastbaar = brutoloon + freelance − pensioenpremie − lijfrenteaftrek', formulaColor:'text-sky-300/80 bg-sky-500/[0.05] border-sky-500/10',
    tip:'Elke extra euro lijfrente verlaagt je belastbaar inkomen in de hoogste schijf — 37,48% voordeel per ingelegde euro.' },
  { id:'woon', icon:Home, name:'Wonen', emoji:'🏠', accentColor:'text-orange-400',
    tagline:'Huur of koop — inclusief EWF, HRA en Wet Hillen.',
    description:['Bij een eigen woning bepaal je het type hypotheek (annuïteit of lineair), het rentepercentage en de WOZ-waarde. De tool berekent het eigenwoningforfait (EWF) en de hypotheekrenteaftrek (HRA).','Wet Hillen: als je hypotheek volledig (of bijna) is afgelost, is de hypotheekrente kleiner dan het EWF. In dat geval kapt de Wet Hillen de belasting over het EWF af.'],
    inputs:['Woningtype (huur / hypotheek)','WOZ-waarde','Hypotheekbedrag & rente','Hypotheekvorm','Looptijd & startjaar','GWE, VvE, overig'],
    example:{ scenario:'Eigen woning, WOZ €350.000, hypotheek €280.000 @ 3,8%', steps:[{label:'WOZ-waarde',value:'€ 350.000'},{label:'Eigenwoningforfait (0,35%)',value:'+ € 1.225'},{label:'Hypotheekrente (jaar 1)',value:'€ 10.640'},{label:'Hypotheekrenteaftrek',value:'− € 10.640'},{label:'Netto aftrek eigen woning',value:'− € 9.415',accent:true}], result:'Belastingbesparing ≈ € 3.527 /jaar (bij 37,48% tarief)' },
    formula:'EWF = WOZ × 0,35%  |  HRA = rente × schijftarief', formulaColor:'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10',
    tip:'WOZ-waarde telt ook mee als actief in je netto vermogen in de Prognose — maar niet in Box 3.' },
  { id:'waardes', icon:Database, name:'Waardes 1 jan', emoji:'📋', accentColor:'text-violet-400',
    tagline:'Box 3 peildatum bezittingen — spaargeld, beleggingen, betaalrekeningen.',
    description:['Box 3 wordt belast op basis van de stand op 1 januari. Hier vul je alle bezittingen in die je op die datum had.','Het overgangsstelsel 2026 gebruikt forfaitaire rendementen per categorie: spaargeld 1,03%, beleggingen 5,88%. Na aftrek van het heffingsvrijvermogen betaal je 36% over de fictieve grondslag.'],
    inputs:['Beleggingsrekeningen (naam + saldo)','Spaarrekeningen (naam + saldo)','Betaalrekeningen (naam + saldo)'],
    example:{ scenario:'Spaar €40.000 + beleggingen €60.000', steps:[{label:'Spaargeld (1,03%)',value:'€ 412'},{label:'Beleggingen (5,88%)',value:'€ 3.528'},{label:'Totaal fictief rendement',value:'€ 3.940'},{label:'Box 3 belasting (36%)',value:'€ 535',accent:true}], result:'Effectief Box 3 tarief ≈ 0,54% over totaal vermogen' },
    formula:'grondslag = Σ(bezitting × forfait) − Σ(schuld × 2,62%)  →  × 36%', formulaColor:'text-violet-300/80 bg-violet-500/[0.05] border-violet-500/10',
    tip:'Alleen de peildatum-stand telt. Geld dat je ná 1 januari ontvangt, valt pas volgend jaar in Box 3.' },
  { id:'expenses', icon:FileText, name:'Kosten', emoji:'🛒', accentColor:'text-rose-400',
    tagline:'Maandelijkse uitgaven, spaar- en beleggingsbijdragen.',
    description:['Vul je vaste en variabele maandelijkse kosten in. De tool berekent je netto besteedbaar inkomen.','De maandelijkse spaar- en beleggingsbedragen worden meegenomen in de 30-jaar Prognose.'],
    inputs:['Boodschappen','Transport','Verzekeringen','Zorg & gezondheid','Onderwijs','Vrije tijd','Overig','Maandelijks sparen','Maandelijks beleggen'],
    example:{ scenario:'Netto inkomen €3.500/m, vaste kosten €2.200', steps:[{label:'Netto maandinkomen',value:'€ 3.500'},{label:'− Vaste kosten',value:'− € 1.700'},{label:'Maandelijks sparen',value:'€ 500'},{label:'Maandelijks beleggen',value:'€ 300'},{label:'Beschikbaar na alles',value:'€ 0',accent:true}], result:'Spaarquote: 23% van netto inkomen' },
    tip:'Verhoog je maandelijkse belegging met €100 en kijk direct in Prognose hoeveel eerder je FIRE kunt bereiken.' },
  { id:'schulden', icon:Coins, name:'Schulden', emoji:'💳', accentColor:'text-amber-400',
    tagline:'DUO-leningen met draagkrachtberekening, beleggingsschulden.',
    description:['DUO-schulden worden afgelost op basis van draagkracht. De tool ondersteunt SF15 (4%) en SF35 (3,5%).','Beleggingsschulden zijn aftrekbaar in Box 3, wat je belasting verlaagt.'],
    inputs:['DUO startbedrag & huidig saldo','Stelsel (SF15 / SF35)','DUO rentepercentage','Beleggingsleningen'],
    example:{ scenario:'DUO schuld €28.000 @ 2,56%, SF15, inkomen €42.000', steps:[{label:'DUO schuld',value:'€ 28.000'},{label:'Jaarlijkse aflossing',value:'≈ € 880 /jaar'},{label:'Restschuld na 15 jaar',value:'≈ € 17.800',accent:true}], result:'DUO telt niet mee als Box 3 aftrekpost.' },
    tip:'DUO-schulden zijn niet aftrekbaar in Box 3, maar beleggingsleningen wel.' },
  { id:'bank', icon:BarChart3, name:'Bankrekeningen', emoji:'🏦', accentColor:'text-teal-400',
    tagline:'Actuele saldi — los van de Box 3 peildatum.',
    description:['Hier vul je de huidige standen in van je spaar- en betaalrekeningen.','Het huidige saldo telt mee in je netto vermogen vandaag en in de Prognose.'],
    inputs:['Naam rekening','Huidig saldo','Spaarrente (% /jaar)','Betaalrekening saldo'],
    example:{ scenario:'ING spaarrekening €22.000 @ 2,1%, betaalrekening €3.500', steps:[{label:'Spaarrekening saldo',value:'€ 22.000'},{label:'Rente per jaar',value:'+ € 462'},{label:'Totaal huidig bankgeld',value:'€ 25.500',accent:true}], result:'Banksaldo groeit mee in de Prognose.' },
    tip:'Betaalrekeningen tellen niet mee voor rente-berekeningen in de prognose.' },
  { id:'portfolio', icon:PieChart, name:'Portfolio', emoji:'📈', accentColor:'text-emerald-400',
    tagline:'Transacties, FIFO-koerswinst, live koersen.',
    description:['Voeg al je beleggingstransacties toe: aankopen, verkopen en dividenden. De tool berekent de FIFO-koerswinst.','De huidige portefeuillewaarde telt mee in je netto vermogen en in de Prognose.'],
    inputs:['Transactiedatum','Ticker / ISIN','Aantal aandelen / units','Aankoopprijs per stuk','Type (koop / verkoop / dividend)'],
    example:{ scenario:'100× VWRL @ €85, koers nu €112', steps:[{label:'Aankoopwaarde',value:'€ 8.500'},{label:'Huidige waarde',value:'€ 11.200'},{label:'Ongerealiseerde winst',value:'+ € 2.700',accent:true}], result:'Koerswinst is in Nederland onbelast.' },
    tip:'Aandelen tellen mee in Box 3 met forfaitair rendement van 5,88% op de 1-jan-waarde.' },
  { id:'afschrijvingen', icon:Shield, name:'Afschrijvingen', emoji:'🔄', accentColor:'text-slate-300',
    tagline:'Sinking fund calculator voor toekomstige vervanging.',
    description:['De afschrijvingensectie berekent per categorie hoeveel je elke maand opzij moet zetten.','De reserve wordt afgetrokken van je netto vermogen — want dat geld is al "beloofd" aan toekomstige uitgaven.'],
    inputs:['Categorienaam','Vervangingswaarde','Resterende levensduur (jaar)','Rente op reserve (%)'],
    example:{ scenario:'Auto €22.000 vervangen na 7 jaar, reserve @ 3%', steps:[{label:'Vervangingswaarde',value:'€ 22.000'},{label:'Vereiste maandinleg',value:'€ 245 /maand',accent:true}], result:'Gereserveerd bedrag trekt van netto vermogen af.' },
    tip:'Een gemiddeld huishouden heeft €300–500/m aan sinking fund nodig voor realistisch vermogensbeheer.' },
  { id:'schenkingen', icon:Gift, name:'Schenkingen', emoji:'🎁', accentColor:'text-purple-400',
    tagline:'Ontvangen schenkingen en schenkbelasting berekening.',
    description:['De tool berekent per schenking hoeveel is vrijgesteld en hoeveel schenkbelasting je betaalt.','Vrijstellingen 2026: van ouders tot €6.908 belastingvrij. Eenmalig verhoogd tot €33.241.'],
    inputs:['Ontvangen bedrag','Relatie (ouder / overig)','Type vrijstelling'],
    example:{ scenario:'Schenking €40.000 van ouders, eenmalig verhoogde vrijstelling', steps:[{label:'Ontvangen bedrag',value:'€ 40.000'},{label:'− Eenmalig vrij (ouder)',value:'− € 33.241'},{label:'Schenkbelasting (10%)',value:'€ 676',accent:true}], result:'Door vrijstelling betaal je slechts €676 i.p.v. €3.329.' },
    formula:'10% over ≤€144.948  |  20% daarboven  (ouder→kind)', formulaColor:'text-purple-300/80 bg-purple-500/[0.05] border-purple-500/10',
    tip:'De eenmalig verhoogde vrijstelling kan slechts één keer in je leven worden gebruikt.' },
  { id:'jaarruimte', icon:BookOpen, name:'Jaarruimte', emoji:'🏛️', accentColor:'text-amber-400',
    tagline:'Fiscale lijfrente- en bankspaarruimte 2026.',
    description:['De jaarruimte is hoeveel je fiscaal aftrekbaar mag inleggen in een lijfrenteverzekering.','Formule: 30% van je premiegrondslag minus Factor A. Onbenutte ruimte van 7 jaar inhaalbaar.'],
    inputs:['Bruto inkomen','Factor A (pensioenaangroei × 7,5)','Reserveringsruimte'],
    example:{ scenario:'Inkomen €65.000, Factor A €1.400', steps:[{label:'Grondslag',value:'€ 45.828'},{label:'Jaarruimte 2026',value:'€ 12.348',accent:true},{label:'Belastingvoordeel',value:'€ 4.626 bespaard'}], result:'Door €12.348 in lijfrente bespaar je €4.626 belasting.' },
    formula:'jaarruimte = max(0, 30% × (inkomen − €19.172) − Factor A)', formulaColor:'text-amber-300/80 bg-amber-500/[0.05] border-amber-500/10',
    tip:'Factor A staat op je UPO (Uniform Pensioenoverzicht).' },
  { id:'prognose', icon:TrendingUp, name:'Prognose', emoji:'🔮', accentColor:'text-orange-400',
    tagline:'30-jaar netto vermogensprognose met FIRE-doelstelling.',
    description:['De prognose groeit je huidige vermogen uit over 30 jaar met spaarsaldo, beleggingen en hypotheekaflossing.','Stel je FIRE-doelstelling in (SWR 3/3.5/4%) en het FI-jaar wordt automatisch berekend.'],
    inputs:['Beleggingsrendement (%)','Spaarrente (%)','Inkomensstijging (%/jaar)','Horizont (10/20/30 jaar)','SWR%','AOW-leeftijd & -bedrag'],
    example:{ scenario:'Vermogen €120.000, inleg €700/m, rendement 7%', steps:[{label:'FIRE-doelstelling (4%)',value:'€ 750.000'},{label:'Verwacht FI-jaar',value:'≈ 2041 (15 jaar)',accent:true}], result:'Na FI onttrek je €30.000/jaar.' },
    formula:'FIRE = (jaaruitgaven − AOW − pensioen) / SWR%', formulaColor:'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10',
    tip:'Afschrijvingsreserves trekken elk jaar af — zo zie je je echte vrije vermogen.' },
  { id:'results', icon:Calculator, name:'Berekening', emoji:'🧮', accentColor:'text-blue-400',
    tagline:'Volledig belastingoverzicht: Box 1, Box 3, toeslagen.',
    description:['Dit tabblad toont het volledige resultaat: Box 1 belasting, Box 3, zorgtoeslag, huurtoeslag en HRA.','Onderaan zie je het netto beschikbaar inkomen per maand en een vermogensoverzicht.'],
    inputs:['(geen invoer — berekend vanuit alle andere tabs)'],
    example:{ scenario:'Bruto €65.000, WOZ €350k, spaar €40k, beleg €60k', steps:[{label:'− Box 1 belasting',value:'− € 21.668'},{label:'− Box 3 belasting',value:'− € 535'},{label:'Netto jaarinkomen',value:'≈ € 46.324',accent:true}], result:'Beschikbaar netto: ≈ € 3.860 / maand.' },
    tip:'Klik op de bedragen in de schijventabel om de berekening per schijf te zien.' },
  { id:'marginale', icon:BarChart2, name:'Marginale Druk', emoji:'📊', accentColor:'text-fuchsia-400',
    tagline:'Hoeveel houd je over van elke extra verdiende euro?',
    description:['Door afbouw van heffingskortingen kan de marginale druk boven 60% uitkomen — zelfs bij modaal inkomen.','De grafiek toont drie lijnen: effectief tarief, marginaal tarief incl. kortingenafbouw, en inclusief zorgtoeslag.'],
    inputs:['(geen extra invoer — berekend vanuit inkomen-tab)'],
    example:{ scenario:'Inkomen stijgt van €40.000 naar €41.000', steps:[{label:'Bruto extra',value:'€ 1.000'},{label:'Netto over',value:'≈ € 507',accent:true},{label:'Marginaal tarief',value:'≈ 49,3%'}], result:'Bij €40k houd je slechts de helft van een loonsverhoging over.' },
    tip:'Rond €40.000–€45.000 is de marginale druk het hoogst. Lijfrente of pensioen storten verlaagt dit.' },
];

interface Props { onClose: () => void; onGetStarted: () => void; onOpenTab: (tab: Tab) => void; }

function useInView(threshold = 0.07) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let s: number | null = null; let raf: number;
    const tick = (ts: number) => { if (!s) s = ts; const p = Math.min((ts-s)/duration,1); setV(Math.round((1-Math.pow(1-p,3))*target)); if (p<1) raf=requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return v;
}

function rv(on: boolean, delay = 0): React.CSSProperties {
  return { opacity: on?1:0, transform: on?'translateY(0)':'translateY(22px)', filter: on?'blur(0px)':'blur(6px)',
    transition: `opacity 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms` };
}

function HudCorners({ color='rgba(0,212,255,0.5)', size=14 }: { color?: string; size?: number }) {
  const b = `1px solid ${color}`;
  const s = (pos: React.CSSProperties): React.CSSProperties => ({ position:'absolute', width:size, height:size, ...pos });
  return (<>
    <span style={s({ top:0, left:0, borderTop:b, borderLeft:b })} />
    <span style={s({ top:0, right:0, borderTop:b, borderRight:b })} />
    <span style={s({ bottom:0, left:0, borderBottom:b, borderLeft:b })} />
    <span style={s({ bottom:0, right:0, borderBottom:b, borderRight:b })} />
  </>);
}

/* ── Reusable section wrapper ── */
function Section({ children, refProp, style }: { children: React.ReactNode; refProp?: React.RefObject<HTMLDivElement | null>; style?: React.CSSProperties }) {
  return (
    <section ref={refProp} className="about-section" style={style}>
      {children}
    </section>
  );
}

export default function AboutPage({ onClose, onGetStarted, onOpenTab }: Props) {
  const [selected, setSelected] = useState<Tab | null>(null);
  const detail = selected ? MODULES.find(m => m.id === selected) ?? null : null;
  const [heroReady, setHeroReady] = useState(false);
  const [featRef, featInView]   = useInView();
  const [calcRef, calcInView]   = useInView();
  const [trustRef, trustInView] = useInView();
  const [ctaRef, ctaInView]     = useInView(0.2);
  const count13 = useCountUp(13, 900, heroReady);

  useEffect(() => { const id = setTimeout(() => setHeroReady(true), 80); return () => clearTimeout(id); }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto antialiased about-root">

      {/* Page-wide subtle grid */}
      <div className="pointer-events-none fixed inset-0 cyber-page-grid" aria-hidden />

      {/* Ambient light blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 -left-48 w-[900px] h-[900px] rounded-full" style={{ background:'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 65%)' }} />
        <div className="absolute top-[30%] -right-48 w-[700px] h-[700px] rounded-full" style={{ background:'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 65%)' }} />
        <div className="absolute -bottom-32 left-[40%] w-[600px] h-[600px] rounded-full" style={{ background:'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 65%)' }} />
      </div>

      {/* ━━━ NAV ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="relative z-20 sticky top-0 backdrop-blur-xl" style={{ background:'rgba(5,5,8,0.88)', borderBottom:'1px solid rgba(0,212,255,0.1)' }}>
        <div className="about-container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background:'linear-gradient(135deg,#f97316,#fbbf24)', boxShadow:'0 0 16px rgba(249,115,22,0.4)' }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="font-bold text-white" style={{ fontFamily:"'Syne',system-ui", fontSize:'0.875rem', letterSpacing:'-0.01em' }}>NL Belasting</span>
            <span className="cyber-mono px-1.5 py-0.5 rounded text-[10px]" style={{ color:'#00d4ff', border:'1px solid rgba(0,212,255,0.3)', background:'rgba(0,212,255,0.06)' }}>2026</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onGetStarted} className="hidden sm:flex items-center gap-1.5 text-xs font-medium cursor-pointer border rounded-lg px-3 py-1.5 transition-all duration-200 about-btn-cyan">
              Open de app <ArrowRight size={11} />
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors bg-transparent border-0 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ━━━ HERO — full-bleed split ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative flex min-h-[92vh] overflow-hidden">

        {/* Left panel — copy */}
        <div className="relative z-10 flex flex-col justify-center w-full lg:w-[50%] about-hero-left">

          {/* Badge */}
          <div style={rv(heroReady,0)}>
            <div className="inline-flex items-center gap-2 rounded border px-3 py-1.5 mb-8 cyber-badge" style={{ borderColor:'rgba(0,212,255,0.3)', background:'rgba(0,212,255,0.06)', color:'#00d4ff' }}>
              <span className="w-1.5 h-1.5 rounded-full cyber-pulse-dot" style={{ background:'#00d4ff' }} />
              <span className="cyber-mono text-[10px] tracking-widest uppercase">Systeem actief · Belastingjaar 2026</span>
            </div>
          </div>

          {/* Headline — 3 lines, no squishing */}
          <div className="mb-6" style={rv(heroReady, 80)}>
            <h1 className="about-headline">
              <span className="block text-white">Je volledige</span>
              <span className="block cyber-headline-accent">financiële plaatje</span>
              <span className="block text-white">in één scherm.</span>
            </h1>
          </div>

          {/* Subtitle */}
          <div style={rv(heroReady, 200)}>
            <p className="text-slate-400 leading-relaxed mb-8 about-subtitle">
              Box 1 &amp; Box 3, toeslagen, hypotheek, DUO, portfolio en 30-jaar prognose —
              berekend volgens de officiële regels. Alles lokaal, niets naar een server.
            </p>
          </div>

          {/* Divider */}
          <div style={rv(heroReady, 270)}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1" style={{ background:'linear-gradient(90deg, rgba(0,212,255,0.35), transparent)' }} />
              <span className="cyber-mono text-[10px] tracking-[0.18em] uppercase" style={{ color:'rgba(0,212,255,0.45)' }}>Kern Data</span>
              <div className="h-px flex-1" style={{ background:'linear-gradient(90deg, transparent, rgba(0,212,255,0.35))' }} />
            </div>
          </div>

          {/* Stats */}
          <div style={rv(heroReady, 330)}>
            <div className="grid grid-cols-4 gap-3 mb-10">
              {[{v:`${count13}`,l:'modules'},{v:'30j',l:'prognose'},{v:'0',l:'cloud data'},{v:'∞',l:"scenario's"}].map(s => (
                <div key={s.l} className="relative p-4 rounded-lg text-center about-stat-cell">
                  <HudCorners color="rgba(0,212,255,0.45)" size={7} />
                  <div className="cyber-mono font-bold text-white about-stat-value">{s.v}</div>
                  <div className="cyber-mono mt-1" style={{ fontSize:'0.58rem', color:'rgba(0,212,255,0.55)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div style={rv(heroReady, 420)}>
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={onGetStarted} className="group flex items-center gap-2 font-bold text-sm rounded-xl px-7 py-3.5 cursor-pointer border transition-all duration-200 about-cta-orange">
                Aan de slag <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </button>
              <a href="#features" className="text-sm font-medium transition-colors" style={{ color:'rgba(0,212,255,0.65)' }}>
                Bekijk modules ↓
              </a>
            </div>
          </div>
        </div>

        {/* Right panel — screenshot, edge-to-edge */}
        <div className="hidden lg:flex lg:w-[50%] items-center justify-start relative pl-12 xl:pl-16 pr-0">

          {/* Left fade so screenshot bleeds into the dark bg */}
          <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none" style={{ background:'linear-gradient(90deg, #050508 0%, transparent 100%)' }} />

          <div className="relative w-full max-w-[680px] cyber-float" style={rv(heroReady, 160)}>

            {/* Glow underneath */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-2/3 h-16 pointer-events-none" style={{ background:'rgba(0,212,255,0.18)', filter:'blur(28px)', borderRadius:'50%' }} />
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-1/2 h-12 pointer-events-none" style={{ background:'rgba(249,115,22,0.1)', filter:'blur(24px)', borderRadius:'50%' }} />

            {/* Browser chrome + screenshot */}
            <div className="relative overflow-hidden rounded-xl" style={{ border:'1px solid rgba(0,212,255,0.28)', boxShadow:'0 0 0 1px rgba(0,212,255,0.08), 0 0 60px rgba(0,212,255,0.12), 0 32px 80px rgba(0,0,0,0.65)' }}>
              <HudCorners color="rgba(0,212,255,0.85)" size={18} />

              {/* Chrome bar */}
              <div className="flex items-center gap-3 px-4 py-2.5" style={{ background:'rgba(0,212,255,0.07)', borderBottom:'1px solid rgba(0,212,255,0.14)' }}>
                <div className="flex gap-1.5">
                  {['rgba(255,59,48,0.75)','rgba(255,196,0,0.75)','rgba(40,205,65,0.75)'].map((c,i) => (
                    <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background:c }} />
                  ))}
                </div>
                <div className="flex-1 flex items-center gap-2 px-2.5 py-1 rounded" style={{ background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.12)' }}>
                  <span className="w-1.5 h-1.5 rounded-full cyber-pulse-dot" style={{ background:'#22c55e', flexShrink:0 }} />
                  <span className="cyber-mono" style={{ fontSize:'0.65rem', color:'rgba(0,212,255,0.55)' }}>nl-belasting.app</span>
                </div>
                <span className="cyber-mono" style={{ fontSize:'0.6rem', letterSpacing:'0.12em', color:'rgba(0,212,255,0.4)' }}>LIVE</span>
              </div>

              {/* Screenshot */}
              <div className="relative">
                <img src={homescreenSrc} alt="NL Belasting Calculator" className="w-full block" />
                {/* Scan line */}
                <div className="screen-scanline" />
                {/* Scanline texture */}
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.015) 3px, rgba(0,212,255,0.015) 4px)' }} />
                {/* Bottom vignette */}
                <div className="absolute inset-0 pointer-events-none" style={{ background:'linear-gradient(to bottom, transparent 60%, rgba(5,5,8,0.5) 100%)' }} />
              </div>
            </div>

            {/* HUD labels */}
            <div className="absolute -top-5 right-4 cyber-mono" style={{ fontSize:'0.6rem', letterSpacing:'0.12em', color:'rgba(0,212,255,0.4)' }}>SYS.OK · v1.16</div>
            <div className="absolute -bottom-5 left-4 cyber-mono" style={{ fontSize:'0.6rem', letterSpacing:'0.12em', color:'rgba(0,212,255,0.35)' }}>PREVIEW · BELASTINGJAAR 2026</div>
          </div>
        </div>

        {/* Vertical divider line between panels (desktop) */}
        <div className="hidden lg:block absolute top-[10%] bottom-[10%] left-1/2 -translate-x-1/2 w-px pointer-events-none" style={{ background:'linear-gradient(to bottom, transparent, rgba(0,212,255,0.15) 30%, rgba(0,212,255,0.15) 70%, transparent)' }} />
      </section>

      {/* All sections share this wrapper for consistent spacing */}
      <div className="about-container">

        {/* ━━━ MODULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section refProp={featRef} style={{ borderTop:'1px solid rgba(0,212,255,0.08)', paddingTop:'5rem', paddingBottom:'5rem' }}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12" style={rv(featInView, 0)}>
            <div>
              <div className="cyber-mono text-[10px] tracking-widest uppercase mb-3" style={{ color:'#f97316' }}>// modules</div>
              <h2 className="about-section-heading">Dertien tabs.<br />Eén consistent model.</h2>
              <p className="mt-4 text-slate-400 leading-relaxed about-body-text max-w-xl">
                Elke tab voedt dezelfde berekeningsmotor — geen losse spreadsheets, geen dubbele invoer. Klik op een module voor uitleg en een voorbeeld.
              </p>
            </div>
            <div className="relative shrink-0 px-6 py-5 rounded-xl text-center" style={{ border:'1px solid rgba(0,212,255,0.15)', background:'rgba(0,212,255,0.04)', minWidth:'130px' }}>
              <HudCorners color="rgba(0,212,255,0.4)" size={8} />
              <div className="cyber-mono font-bold text-white" style={{ fontSize:'2.5rem' }}>13</div>
              <div className="cyber-mono text-[10px] tracking-widest uppercase mt-1" style={{ color:'rgba(0,212,255,0.5)' }}>modules actief</div>
            </div>
          </div>

          {/* Grid */}
          <div className="about-modules-grid" style={{ border:'1px solid rgba(0,212,255,0.1)', borderRadius:'1rem', overflow:'hidden', background:'rgba(0,212,255,0.02)' }}>
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const isSel = selected === mod.id;
              return (
                <button key={mod.id} onClick={() => setSelected(isSel ? null : mod.id)}
                  className="relative text-left p-5 cursor-pointer border-0 w-full group about-mod-btn"
                  style={{
                    background: isSel ? 'rgba(0,212,255,0.05)' : 'rgba(5,5,8,0.96)',
                    boxShadow: isSel ? 'inset 0 0 0 1px rgba(0,212,255,0.22)' : 'none',
                    opacity: featInView ? 1 : 0,
                    transform: featInView ? 'translateY(0)' : 'translateY(10px)',
                    filter: featInView ? 'blur(0)' : 'blur(3px)',
                    transition: `opacity 380ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i*28,340)+80}ms, transform 380ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i*28,340)+80}ms, filter 380ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i*28,340)+80}ms, background 150ms ease, box-shadow 150ms ease`,
                  }}>
                  {isSel && <HudCorners color="rgba(0,212,255,0.65)" size={10} />}
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center transition-all duration-200 ${isSel ? mod.accentColor : 'text-slate-500 group-hover:text-slate-300'}`}
                      style={{ background: isSel ? 'rgba(0,212,255,0.09)' : 'rgba(255,255,255,0.03)', border:`1px solid ${isSel ? 'rgba(0,212,255,0.28)' : 'rgba(255,255,255,0.06)'}`, transform: isSel ? 'scale(1.1)' : undefined }}>
                      <Icon size={14} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">{mod.emoji} {mod.name}</span>
                        <ChevronRight size={11} style={{ color: isSel ? '#00d4ff' : '#475569', transform: isSel ? 'rotate(90deg)' : undefined, transition:'transform 200ms ease' }} />
                      </div>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: isSel ? 'rgba(0,212,255,0.65)' : '#64748b' }}>{mod.tagline}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {detail && (
            <div key={detail.id} className="mt-4 overflow-hidden about-detail-enter relative rounded-2xl" style={{ border:'1px solid rgba(0,212,255,0.18)', background:'linear-gradient(135deg, rgba(0,212,255,0.04) 0%, rgba(5,5,8,0.97) 50%)' }}>
              <HudCorners color="rgba(0,212,255,0.55)" size={20} />
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center about-icon-pop ${detail.accentColor}`} style={{ background:'rgba(0,212,255,0.07)', border:'1px solid rgba(0,212,255,0.22)' }}>
                      <detail.icon size={22} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xl">{detail.emoji} {detail.name}</div>
                      <p className={`text-sm mt-0.5 ${detail.accentColor}`}>{detail.tagline}</p>
                    </div>
                  </div>
                  <button onClick={() => onOpenTab(detail.id)} className="shrink-0 flex items-center gap-1.5 text-xs font-bold cursor-pointer border rounded-lg px-4 py-2 transition-all duration-200 about-btn-cyan">
                    Open tab <ArrowRight size={11} />
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <div className="cyber-mono text-[10px] uppercase tracking-widest mb-3" style={{ color:'rgba(0,212,255,0.5)' }}>// uitleg</div>
                      {detail.description.map((p, i) => <p key={i} className="text-sm text-slate-400 leading-relaxed mb-3">{p}</p>)}
                    </div>
                    <div>
                      <div className="cyber-mono text-[10px] uppercase tracking-widest mb-3" style={{ color:'rgba(0,212,255,0.5)' }}>// invoervelden</div>
                      <ul className="space-y-1.5">{detail.inputs.map(inp => (
                        <li key={inp} className="flex items-center gap-2 text-sm text-slate-400">
                          <span className="cyber-mono text-[10px]" style={{ color:'#00d4ff' }}>›</span>{inp}
                        </li>
                      ))}</ul>
                    </div>
                    {detail.formula && (
                      <div>
                        <div className="cyber-mono text-[10px] uppercase tracking-widest mb-2" style={{ color:'rgba(0,212,255,0.5)' }}>// formule</div>
                        <div className={`cyber-mono text-[11px] rounded-lg px-3 py-2 border leading-relaxed ${detail.formulaColor}`}>{detail.formula}</div>
                      </div>
                    )}
                    <div className="rounded-xl p-4" style={{ background:'rgba(0,212,255,0.03)', border:'1px solid rgba(0,212,255,0.1)' }}>
                      <div className="cyber-mono text-[10px] uppercase tracking-widest mb-2" style={{ color:'rgba(0,212,255,0.5)' }}>// pro tip</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{detail.tip}</p>
                    </div>
                  </div>
                  <div>
                    <div className="cyber-mono text-[10px] uppercase tracking-widest mb-3" style={{ color:'rgba(0,212,255,0.5)' }}>// voorbeeld</div>
                    <div className="rounded-xl overflow-hidden" style={{ background:'rgba(3,3,6,0.92)', border:'1px solid rgba(0,212,255,0.1)' }}>
                      <div className="px-4 py-3" style={{ borderBottom:'1px solid rgba(0,212,255,0.08)', background:'rgba(0,212,255,0.03)' }}>
                        <p className="text-xs text-slate-400 italic">{detail.example.scenario}</p>
                      </div>
                      <div>{detail.example.steps.map((step, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom:'1px solid rgba(0,212,255,0.05)', background:step.accent?'rgba(0,212,255,0.03)':undefined }}>
                          <span className="text-xs text-slate-500">{step.label}</span>
                          <span className={`cyber-mono text-xs tabular-nums ${step.accent?`font-bold ${detail.accentColor}`:'text-slate-300'}`}>{step.value}</span>
                        </div>
                      ))}</div>
                      <div className="px-4 py-3" style={{ background:'rgba(0,212,255,0.03)' }}>
                        <p className="text-xs text-slate-400 leading-relaxed">{detail.example.result}</p>
                      </div>
                    </div>
                    <button onClick={() => onOpenTab(detail.id)} className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium cursor-pointer rounded-xl py-3 transition-all duration-200 about-btn-cyan">
                      Open de {detail.name}-tab <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ━━━ CALCULATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section refProp={calcRef} style={{ borderTop:'1px solid rgba(0,212,255,0.08)', paddingTop:'5rem', paddingBottom:'5rem' }}>
          <div className="mb-12" style={rv(calcInView, 0)}>
            <div className="cyber-mono text-[10px] tracking-widest uppercase mb-3" style={{ color:'rgba(139,92,246,0.8)' }}>// berekeningen</div>
            <h2 className="about-section-heading">Hoe de cijfers tot stand komen.</h2>
            <p className="mt-4 text-slate-400 leading-relaxed about-body-text max-w-2xl">Alle formules volgen de officiële belastingregels voor 2026.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { col:'#3b82f6', Icon:Calculator, title:'Box 1 — inkomen', items:['Bruto loon + freelance − pensioenpremies − lijfrenteaftrek','EWF bovenop, − hypotheekrente (HRA); Wet Hillen kapt af bij volledig afgelost','Drie schijven: 35,82% / 37,48% / 49,5%','Algemene heffingskorting + arbeidskorting'], formula:'netto = (inkomen × schijftarief) − heffingskortingen', fCol:'text-blue-300/80 bg-blue-500/[0.05] border-blue-500/10', delay:0 },
              { col:'#8b5cf6', Icon:LineChart,  title:'Box 3 — vermogen', items:['Overgangsstelsel 2026 — fictief rendement per categorie','Spaargeld 1,03% · Beleggingen 5,88% · Schulden 2,62%','Heffingvrij vermogen €57.684 (€115.368 partners)','Tarief 36% over de fictieve grondslag'], formula:'belasting = (Σ tarief × bezit) × 36%', fCol:'text-violet-300/80 bg-violet-500/[0.05] border-violet-500/10', delay:80 },
              { col:'#14b8a6', Icon:Gift,       title:'Toeslagen', items:['Zorgtoeslag: normpremie minus 5,75% × toetsingsinkomen','Huurtoeslag: bij huur onder de grens en inkomen-eligible','HRA: belastingvoordeel hypotheekrente in Box 1'], formula:'zorgtoeslag = max(0, min(max, norm − 0,0575 × inkomen))', fCol:'text-teal-300/80 bg-teal-500/[0.05] border-teal-500/10', delay:160 },
              { col:'#f97316', Icon:TrendingUp, title:'Prognose — netto vermogen', items:['Spaarsaldo met spaarrente + maandelijkse inleg','Beleggingen met aangenomen rendement + maandelijkse inleg','Hypotheek volgt aflossingsschema; DUO via draagkracht','WOZ-waarde als constante actief; afschrijvingsreserve trekt af'], formula:'netto = spaar + beleg + WOZ − schulden − reserve', fCol:'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10', delay:240 },
            ].map(({ col, Icon, title, items, formula, fCol, delay }) => (
              <article key={title} className="relative overflow-hidden rounded-2xl p-7 group"
                style={{ ...rv(calcInView, delay+80), background:'rgba(7,7,14,0.94)', border:`1px solid rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},0.16)` }}>
                <HudCorners color={`${col}55`} size={12} />
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-60" style={{ background:`radial-gradient(circle, ${col}18 0%, transparent 70%)` }} />
                <div className="relative">
                  <div className="flex items-center gap-2.5 mb-5">
                    <Icon size={15} style={{ color:col }} />
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-400 mb-5">
                    {items.map(item => (
                      <li key={item} className="flex gap-2.5">
                        <span className="cyber-mono text-[10px] mt-0.5 shrink-0" style={{ color:col }}>›</span>{item}
                      </li>
                    ))}
                  </ul>
                  <div className={`cyber-mono text-[11px] rounded-lg px-3 py-2 border leading-relaxed ${fCol}`}>{formula}</div>
                </div>
              </article>
            ))}
          </div>
        </Section>

        {/* ━━━ TRUST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section refProp={trustRef} style={{ borderTop:'1px solid rgba(0,212,255,0.08)', paddingTop:'5rem', paddingBottom:'5rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { Icon:Lock,     title:'Privacy by design', body:'Alle data blijft in jouw browser via localStorage. Geen account, geen server, geen tracking.', col:'#22c55e', delay:0 },
              { Icon:Zap,      title:'Realtime alles',    body:'Elke wijziging herberekent direct. Geen "submit", geen wachten — gewoon scrollen en zien.', col:'#00d4ff', delay:80 },
              { Icon:Sparkles, title:'Export & import',   body:"Bewaar volledige scenario's als JSON. Vergelijk wat-als situaties zonder data te verliezen.", col:'#f97316', delay:160 },
            ].map(({ Icon, title, body, col, delay }) => (
              <div key={title} className="relative overflow-hidden rounded-2xl p-8 group transition-all duration-300"
                style={{ ...rv(trustInView, delay), background:'rgba(7,7,14,0.94)', border:`1px solid rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},0.15)` }}>
                <HudCorners color={`${col}55`} size={10} />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" style={{ background:`radial-gradient(circle at 50% 0%, ${col}09 0%, transparent 60%)` }} />
                <Icon size={16} style={{ color:col, marginBottom:'1rem', position:'relative' }} />
                <h3 className="text-base font-semibold text-white mb-2 relative">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed relative">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ━━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section refProp={ctaRef} style={{ borderTop:'1px solid rgba(0,212,255,0.08)', paddingTop:'5rem', paddingBottom:'6rem' }}>
          <div className="relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center" style={{ ...rv(ctaInView, 0), border:'1px solid rgba(0,212,255,0.18)', background:'rgba(5,5,10,0.96)' }}>
            <HudCorners color="rgba(0,212,255,0.55)" size={26} />
            <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(0,212,255,0.07) 0%, transparent 60%)' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(249,115,22,0.06) 0%, transparent 60%)' }} />
            <div className="relative">
              <div className="cyber-mono text-[10px] tracking-widest uppercase mb-6" style={{ color:'rgba(0,212,255,0.45)' }}>// klaar om te starten?</div>
              <h2 style={{ fontFamily:"'Syne',system-ui", fontWeight:800, letterSpacing:'-0.01em', color:'#f0f4f8', margin:'0 0 1.25rem', lineHeight:1.1 }} className="about-cta-heading">
                Klaar om de cijfers<br /><span style={{ color:'rgba(0,212,255,0.65)' }}>te zien?</span>
              </h2>
              <p className="text-slate-400 leading-relaxed mb-10 max-w-lg mx-auto about-body-text">
                Geen registratie nodig. Vul je gegevens in op de tabs — resultaten verschijnen live aan de rechterkant.
              </p>
              <button onClick={onGetStarted} className="group inline-flex items-center gap-2 font-bold text-sm rounded-xl px-9 py-4 cursor-pointer border transition-all duration-200 about-cta-blue"
                style={{ fontFamily:"'Syne',system-ui" }}>
                Open de app <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </Section>

        <footer className="py-10 text-center" style={{ borderTop:'1px solid rgba(0,212,255,0.07)' }}>
          <p className="cyber-mono text-[11px]" style={{ color:'rgba(0,212,255,0.22)' }}>
            Indicatieve berekening o.b.v. belastingregels 2026. Geen vervanging voor professioneel advies.
          </p>
        </footer>
      </div>
    </div>
  );
}
