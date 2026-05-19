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
  accentColor: string; glowColor: string; tagline: string;
  description: string[]; inputs: string[];
  example: { scenario: string; steps: ExampleStep[]; result: string };
  formula?: string; formulaColor?: string; tip: string;
}

const MODULES: ModuleDetail[] = [
  { id:'income', icon:Wallet, name:'Inkomen', emoji:'💼', accentColor:'text-sky-400', glowColor:'bg-sky-500/10',
    tagline:'Bruto naar netto — alle Box 1 bronnen in één scherm.',
    description:['Vul je bruto inkomen in uit alle bronnen: vast dienstverband, freelance, huurinkomsten of andere Box 1 inkomsten. De tool berekent automatisch de belastingschijven en heffingskortingen.','Pensioenpremies en lijfrentepremies verlagen je belastbaar inkomen, zodat je direct ziet hoeveel minder belasting je betaalt door fiscaal gunstig te sparen.'],
    inputs:['Bruto jaarsalaris','Freelance/ZZP inkomen','Huurinkomsten','Overig Box 1','Werknemerspensioenpremie','Lijfrenteaftrek'],
    example:{ scenario:'Salariswerknemer, €65.000 bruto, pensioenpremie €5.500', steps:[{label:'Bruto inkomen',value:'€ 65.000'},{label:'− pensioenpremie',value:'− € 5.500'},{label:'Belastbaar Box 1',value:'€ 59.500'},{label:'Schijf 1 (≤€38.441)',value:'€ 13.770  (35,82%)'},{label:'Schijf 2 (€38.441–€76.817)',value:'€ 7.898  (37,48%)'},{label:'− Algemene heffingskorting',value:'− € 1.882'},{label:'− Arbeidskorting',value:'− € 2.214'},{label:'Netto te betalen',value:'€ 17.572',accent:true}], result:'Netto jaarinkomen ≈ € 41.928 (€ 3.494 / maand)' },
    formula:'belastbaar = brutoloon + freelance − pensioenpremie − lijfrenteaftrek', formulaColor:'text-sky-300/80 bg-sky-500/[0.05] border-sky-500/10',
    tip:'Elke extra euro lijfrente verlaagt je belastbaar inkomen in de hoogste schijf — bij €59.500 is dat 37,48% voordeel per ingelegde euro.' },
  { id:'woon', icon:Home, name:'Wonen', emoji:'🏠', accentColor:'text-orange-400', glowColor:'bg-orange-500/10',
    tagline:'Huur of koop — inclusief EWF, HRA en Wet Hillen.',
    description:['Bij een eigen woning bepaal je het type hypotheek (annuïteit of lineair), het rentepercentage en de WOZ-waarde. De tool berekent het eigenwoningforfait (EWF) en de hypotheekrenteaftrek (HRA).','Wet Hillen: als je hypotheek volledig (of bijna) is afgelost, is de hypotheekrente kleiner dan het EWF. In dat geval kapt de Wet Hillen de belasting over het EWF af.'],
    inputs:['Woningtype (huur / hypotheek)','WOZ-waarde','Hypotheekbedrag & rente','Hypotheekvorm (annuïteit/lineair)','Looptijd & startjaar','GWE, VvE, overig'],
    example:{ scenario:'Eigen woning, WOZ €350.000, hypotheek €280.000 @ 3,8%', steps:[{label:'WOZ-waarde',value:'€ 350.000'},{label:'Eigenwoningforfait (0,35%)',value:'+ € 1.225'},{label:'Hypotheekrente (jaar 1)',value:'€ 10.640'},{label:'Hypotheekrenteaftrek',value:'− € 10.640'},{label:'Netto aftrek eigen woning',value:'− € 9.415',accent:true}], result:'Belastingbesparing ≈ € 3.527 /jaar (bij 37,48% tarief)' },
    formula:'EWF = WOZ × 0,35%  |  HRA = rente × schijftarief  |  Wet Hillen: aftrek = max(0, HRA − EWF)', formulaColor:'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10',
    tip:'WOZ-waarde telt ook mee als actief in je netto vermogen in de Prognose — maar niet in Box 3.' },
  { id:'waardes', icon:Database, name:'Waardes 1 jan', emoji:'📋', accentColor:'text-violet-400', glowColor:'bg-violet-500/10',
    tagline:'Box 3 peildatum bezittingen — spaargeld, beleggingen, betaalrekeningen.',
    description:['Box 3 wordt belast op basis van de stand op 1 januari. Hier vul je alle bezittingen in die je op die datum had. Schulden voer je in bij de Schulden-tab.','Het overgangsstelsel 2026 gebruikt forfaitaire rendementen per categorie: spaargeld rendeert fictief 1,03%, beleggingen 5,88%. Na aftrek van het heffingsvrijvermogen (€57.684) betaal je 36% over de fictieve grondslag.'],
    inputs:['Beleggingsrekeningen (naam + saldo)','Spaarrekeningen (naam + saldo)','Betaalrekeningen (naam + saldo)'],
    example:{ scenario:'Spaar €40.000 + beleggingen €60.000, geen schulden', steps:[{label:'Spaargeld (1,03%)',value:'€ 412'},{label:'Beleggingen (5,88%)',value:'€ 3.528'},{label:'Totaal fictief rendement',value:'€ 3.940'},{label:'− Heffingsvrijvermogen',value:'− € 57.684 × (100k/100k) = ÷ alles'},{label:'Grondslag (100k > vrijstelling)',value:'€ 3.940 × (42.316/100.000)'},{label:'Box 3 belasting (36%)',value:'€ 535',accent:true}], result:'Effectief Box 3 tarief ≈ 0,54% over totaal vermogen' },
    formula:'grondslag = Σ(bezitting × forfait) − Σ(schuld × 2,62%)  →  × 36%', formulaColor:'text-violet-300/80 bg-violet-500/[0.05] border-violet-500/10',
    tip:'Alleen de peildatum-stand telt. Geld dat je ná 1 januari ontvangt, valt pas volgend jaar in Box 3.' },
  { id:'expenses', icon:FileText, name:'Kosten', emoji:'🛒', accentColor:'text-rose-400', glowColor:'bg-rose-500/10',
    tagline:'Maandelijkse uitgaven, spaar- en beleggingsbijdragen.',
    description:['Vul je vaste en variabele maandelijkse kosten in. De tool berekent je netto besteedbaar inkomen en laat zien welk percentage je spaart of belegt.','De maandelijkse spaar- en beleggingsbedragen worden ook meegenomen in de 30-jaar Prognose, zodat je direct ziet wat het effect is van meer of minder inleggen.'],
    inputs:['Boodschappen','Transport','Verzekeringen','Zorg & gezondheid','Onderwijs','Vrije tijd & uit eten','Overig','Maandelijks sparen','Maandelijks beleggen'],
    example:{ scenario:'Netto inkomen €3.500/m, vaste kosten €2.200', steps:[{label:'Netto maandinkomen',value:'€ 3.500'},{label:'− Boodschappen',value:'− € 500'},{label:'− Transport',value:'− € 300'},{label:'− Verzekeringen',value:'− € 250'},{label:'− Overig kosten',value:'− € 650'},{label:'Maandelijks sparen',value:'€ 500'},{label:'Maandelijks beleggen',value:'€ 300'},{label:'Beschikbaar na alles',value:'€ 0',accent:true}], result:'Spaarquote: 23% van netto inkomen — ruim boven het nationale gemiddelde' },
    tip:'Verhoog je maandelijkse belegging met €100 en kijk direct in Prognose hoeveel eerder je FIRE kunt bereiken.' },
  { id:'schulden', icon:Coins, name:'Schulden', emoji:'💳', accentColor:'text-amber-400', glowColor:'bg-amber-500/10',
    tagline:'DUO-leningen met draagkrachtberekening, beleggingsschulden.',
    description:['DUO-schulden worden afgelost op basis van draagkracht: een percentage van je inkomen boven een drempel. De tool ondersteunt zowel het oude stelsel (SF15, 4% boven drempel) als het nieuwe stelsel (SF35, 3,5% over 35 jaar).','Beleggingsschulden zijn aftrekbaar in Box 3, wat je Box 3 belasting verlaagt. Je ziet direct het gecombineerde effect op de belastingberekening.'],
    inputs:['DUO startbedrag & huidig saldo','Stelsel (SF15 / SF35)','DUO rentepercentage','Beleggingsleningen (naam + bedrag + rente)'],
    example:{ scenario:'DUO schuld €28.000 @ 2,56%, SF15, inkomen €42.000', steps:[{label:'DUO schuld',value:'€ 28.000'},{label:'DUO rente',value:'2,56%'},{label:'Draagkrachtbasis SF15',value:'4% × max(0, inkomen − drempel)'},{label:'Jaarlijkse aflossing',value:'≈ € 880 /jaar'},{label:'Restschuld na 15 jaar',value:'≈ € 17.800',accent:true},{label:'Box 3 aftrek schuld',value:'2,62% × €28.000 = −€734'}], result:'DUO telt niet mee als Box 3 aftrekpost — alleen beleggingsleningen doen dat.' },
    tip:'DUO-schulden zijn niet aftrekbaar in Box 3, maar beleggingsleningen wel. Houd dat onderscheid in de gaten.' },
  { id:'bank', icon:BarChart3, name:'Bankrekeningen', emoji:'🏦', accentColor:'text-teal-400', glowColor:'bg-teal-500/10',
    tagline:'Actuele saldi — los van de Box 3 peildatum.',
    description:['Hier vul je de huidige standen in van je spaar- en betaalrekeningen. Dit is het geld dat je nu hebt, los van wat je op 1 januari (Box 3 peildatum) had.','Het huidige saldo telt mee in je netto vermogen vandaag en in de Prognose. De spaarrente die je hier invoert, wordt gebruikt om het saldo te laten groeien over de jaren.'],
    inputs:['Naam rekening','Huidig saldo','Spaarrente (% /jaar)','Betaalrekening saldo'],
    example:{ scenario:'ING spaarrekening €22.000 @ 2,1%, betaalrekening €3.500', steps:[{label:'Spaarrekening saldo',value:'€ 22.000'},{label:'Rente per jaar (2,1%)',value:'+ € 462'},{label:'Betaalrekening',value:'€ 3.500'},{label:'Totaal huidig bankgeld',value:'€ 25.500',accent:true},{label:'Na 1 jaar (geen inleg)',value:'€ 25.962'}], result:'Banksaldo groeit mee in de Prognose inclusief maandelijkse spaarbijdragen uit de Kosten-tab.' },
    tip:'Houd betaalrekeningen en spaarrekeningen gescheiden — betaalrekeningen tellen niet mee voor rente-berekeningen in de prognose.' },
  { id:'portfolio', icon:PieChart, name:'Portfolio', emoji:'📈', accentColor:'text-emerald-400', glowColor:'bg-emerald-500/10',
    tagline:'Transacties, FIFO-koerswinst, live koersen.',
    description:['Voeg al je beleggingstransacties toe: aankopen, verkopen en dividenduitkeringen. De tool berekent de FIFO-koerswinst (gerealiseerd én ongerealiseerd) en haalt live koersen op.','De huidige portefeuillewaarde telt mee in je netto vermogen en in de Prognose. Box 3 peildatumsaldi voer je separaat in bij "Waardes 1 jan".'],
    inputs:['Transactiedatum','Ticker / ISIN','Aantal aandelen / units','Aankoopprijs per stuk','Type (koop / verkoop / dividend)'],
    example:{ scenario:'100× VWRL aangekocht jan 2023 @ €85, koers nu €112', steps:[{label:'Aankoopwaarde',value:'€ 8.500'},{label:'Huidige waarde',value:'€ 11.200'},{label:'Ongerealiseerde winst',value:'+ € 2.700',accent:true},{label:'FIFO kostprijs',value:'€ 85,00 / stuk'},{label:'Bij verkoop 50 aandelen',value:'winst = 50 × (€112 − €85) = €1.350'}], result:'Koerswinst is in Nederland onbelast — dividend wordt belast via fictief rendement in Box 3.' },
    tip:'In Nederland is koerswinst onbelast. Aandelen tellen mee in Box 3 met forfaitair rendement van 5,88% op de 1-jan-waarde.' },
  { id:'afschrijvingen', icon:Shield, name:'Afschrijvingen', emoji:'🔄', accentColor:'text-slate-300', glowColor:'bg-slate-500/10',
    tagline:'Sinking fund calculator voor toekomstige vervanging.',
    description:['Grote uitgaven komen altijd: een nieuwe auto, vervanging van witgoed, dak, ketel. De afschrijvingensectie berekent per categorie hoeveel je elke maand opzij moet zetten om die kosten te kunnen dragen.','De opgebouwde reserve wordt afgetrokken van je netto vermogen — want dat geld is al "beloofd" aan een toekomstige uitgave. Zo krijg je een realistisch beeld van je beschikbaar vrij vermogen.'],
    inputs:['Categorienaam (bijv. Auto)','Vervangingswaarde','Resterende levensduur (jaar)','Rente op reserve (%)'],
    example:{ scenario:'Auto €22.000 vervangen na 7 jaar, reserve @ 3%', steps:[{label:'Vervangingswaarde',value:'€ 22.000'},{label:'Levensduur',value:'7 jaar'},{label:'Reserve rente',value:'3% /jaar'},{label:'Vereiste maandinleg',value:'€ 245 /maand',accent:true},{label:'Totaal gereserveerd',value:'€ 20.580 + rente = €22.000'}], result:'Gereserveerd bedrag trekt van je netto vermogen af in de prognose — realistischer dan zonder.' },
    tip:'Voeg ook ketel, dak en witgoed toe. Een gemiddeld huishouden heeft €300–500/m aan sinking fund nodig voor realistisch vermogensbeheer.' },
  { id:'schenkingen', icon:Gift, name:'Schenkingen', emoji:'🎁', accentColor:'text-purple-400', glowColor:'bg-purple-500/10',
    tagline:'Ontvangen schenkingen en schenkbelasting berekening.',
    description:['Voeg schenkingen toe die je hebt ontvangen van ouders of anderen. De tool berekent per schenking hoeveel is vrijgesteld, wat belastbaar is en hoeveel schenkbelasting je betaalt.','Vrijstellingen 2026: van ouders ontvang je jaarlijks tot €6.908 belastingvrij. Er is ook een eenmalig verhoogde vrijstelling van €33.241 (vrij besteedbaar) of €69.225 (dure studie) voor ontvangers tussen 18 en 40 jaar.'],
    inputs:['Ontvangen bedrag','Relatie (ouder / overig)','Type vrijstelling','Omschrijving'],
    example:{ scenario:'Schenking €40.000 van ouders, eenmalig verhoogde vrijstelling', steps:[{label:'Ontvangen bedrag',value:'€ 40.000'},{label:'− Eenmalig vrij (ouder)',value:'− € 33.241'},{label:'Belastbaar deel',value:'€ 6.759'},{label:'Schenkbelasting (10%)',value:'€ 676',accent:true},{label:'Netto ontvangen',value:'€ 39.324'}], result:'Door de eenmalig verhoogde vrijstelling betaal je slechts €676 in plaats van €3.329.' },
    formula:'belasting = schijf1: 10% over ≤€144.948  |  schijf2: 20% daarboven  (ouder→kind)', formulaColor:'text-purple-300/80 bg-purple-500/[0.05] border-purple-500/10',
    tip:'De eenmalig verhoogde vrijstelling kan slechts één keer in je leven worden gebruikt en vervangt de jaarlijkse vrijstelling. De jubelton (eigen woning) is per 2024 afgeschaft.' },
  { id:'jaarruimte', icon:BookOpen, name:'Jaarruimte', emoji:'🏛️', accentColor:'text-amber-400', glowColor:'bg-amber-500/10',
    tagline:'Fiscale lijfrente- en bankspaarruimte 2026.',
    description:['De jaarruimte is hoeveel je fiscaal aftrekbaar mag inleggen in een lijfrenteverzekering of bankspaarproduct. Je betaalt nu minder belasting en belegt voor later.','De formule is 30% van je premiegrondslag (inkomen − AOW franchise €19.172) minus Factor A (de pensioenopbouw van je werkgever). Onbenutte ruimte van de afgelopen 7 jaar mag je inhalen als reserveringsruimte (max €40.248).'],
    inputs:['Bruto inkomen','Factor A (jaarlijkse pensioenaangroei × 7,5)','Reserveringsruimte (voorgaande jaren)'],
    example:{ scenario:'Inkomen €65.000, Factor A €1.400, geen reserveringsruimte', steps:[{label:'Grondslag (inkomen − franchise)',value:'€ 65.000 − €19.172 = €45.828'},{label:'30% van grondslag',value:'€ 13.748'},{label:'− Factor A',value:'− € 1.400'},{label:'Jaarruimte 2026',value:'€ 12.348',accent:true},{label:'Belastingvoordeel @ 37,48%',value:'€ 4.626 bespaard'}], result:'Door €12.348 in een lijfrente te storten bespaar je €4.626 aan belasting dit jaar.' },
    formula:'jaarruimte = max(0, 30% × (inkomen − €19.172) − Factor A)', formulaColor:'text-amber-300/80 bg-amber-500/[0.05] border-amber-500/10',
    tip:'Factor A vraag je op bij je pensioenfonds of werkgever. Het staat ook op je UPO (Uniform Pensioenoverzicht).' },
  { id:'prognose', icon:TrendingUp, name:'Prognose', emoji:'🔮', accentColor:'text-orange-400', glowColor:'bg-orange-500/10',
    tagline:'30-jaar netto vermogensprognose met FIRE-doelstelling.',
    description:['De prognose groeit je huidige vermogen uit over 30 jaar: spaarsaldo met spaarrente + inleg, beleggingen met rendement + maandelijkse inleg, hypotheek volgt het aflossingsschema.','Stel je FIRE-doelstelling in: gewenste SWR (3/3.5/4%), je verwachte jaaruitgaven, AOW-leeftijd en -bedrag. Het FI-jaar wordt berekend als je vermogen de FIRE-drempel overschrijdt.'],
    inputs:['Verwacht beleggingsrendement (%)','Spaarrente (%)','Inkomensstijging (%/jaar)','Horizont (10/20/30 jaar)','SWR% (3/3,5/4%)','AOW-leeftijd & -bedrag'],
    example:{ scenario:'Vermogen €120.000, inleg €700/m belegen, rendement 7%, uitgaven €2.500/m', steps:[{label:'Huidig vermogen',value:'€ 120.000'},{label:'Maandelijkse inleg',value:'€ 700 /maand'},{label:'Rendement beleggingen',value:'7% /jaar'},{label:'FIRE-doelstelling (4%)',value:'€ 2.500 × 12 / 4% = € 750.000'},{label:'Verwacht FI-jaar',value:'≈ 2041 (15 jaar)',accent:true},{label:'AOW bij 67 (€1.400/m)',value:'Verlaagt onttrekking met €16.800/j'}], result:'Na FI trek je €30.000/jaar op; met AOW daalt dat naar €13.200/jaar vanuit portfolio.' },
    formula:'FIRE = (jaaruitgaven − AOW − pensioen) / SWR%', formulaColor:'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10',
    tip:'WOZ-waarde wordt meegeteld als constant actief. Afschrijvingsreserves worden elk jaar afgetrokken — zo zie je je echte vrije vermogen.' },
  { id:'results', icon:Calculator, name:'Berekening', emoji:'🧮', accentColor:'text-blue-400', glowColor:'bg-blue-500/10',
    tagline:'Volledig belastingoverzicht: Box 1, Box 3, toeslagen.',
    description:['Dit tabblad toont het volledige resultaat van alle invoer: Box 1 belasting per schijf, heffingskortingen, Box 3 vermogensbelasting, zorgtoeslag, huurtoeslag en hypotheekrenteaftrek.','Onderaan zie je het netto beschikbaar inkomen per maand en een overzicht van je netto vermogen inclusief WOZ en afschrijvingsreserve.'],
    inputs:['(geen invoer — berekend vanuit alle andere tabs)'],
    example:{ scenario:'Bruto €65.000, eigen woning WOZ €350k, spaar €40k, beleg €60k', steps:[{label:'Bruto inkomen',value:'€ 65.000'},{label:'− Box 1 belasting',value:'− € 21.668'},{label:'− Box 3 belasting',value:'− € 535'},{label:'+ Zorgtoeslag',value:'+ € 0 (te hoog inkomen)'},{label:'+ HRA voordeel',value:'+ € 3.527'},{label:'Netto jaarinkomen',value:'≈ € 46.324',accent:true},{label:'Netto vermogen nu',value:'spaar + beleg + WOZ − schulden'}], result:'Beschikbaar netto: ≈ € 3.860 / maand — na belasting, voor vaste lasten.' },
    tip:'Klik op de euro-bedragen in de schijventabel om te zien hoe de grens precies berekend wordt per schijf.' },
  { id:'marginale', icon:BarChart2, name:'Marginale Druk', emoji:'📊', accentColor:'text-fuchsia-400', glowColor:'bg-fuchsia-500/10',
    tagline:'Hoeveel houd je over van elke extra verdiende euro?',
    description:['De marginale druk is het percentage dat je kwijt bent van de volgende euro die je verdient. Door afbouw van heffingskortingen en zorgtoeslag kan dit boven de 60% uitkomen — zelfs bij een modaal inkomen.','De grafiek toont drie lijnen: effectief tarief (blauw), marginaal tarief incl. kortingenafbouw (oranje) en het gecombineerde effect inclusief zorgtoeslag (teal).'],
    inputs:['(geen extra invoer — berekend vanuit inkomen-tab)'],
    example:{ scenario:'Inkomen stijgt van €40.000 naar €41.000 — wat houd je netto over?', steps:[{label:'Bruto extra inkomen',value:'€ 1.000'},{label:'− Schijftarief 2 (37,48%)',value:'− € 375'},{label:'− Afbouw arbeidskorting',value:'− € 60'},{label:'− Afbouw zorgtoeslag (5,75%)',value:'− € 58'},{label:'Netto over van €1.000',value:'≈ € 507',accent:true},{label:'Effectief marginaal tarief',value:'≈ 49,3%'}], result:'Bij €40k inkomen houd je slechts de helft van een loonsverhoging netto over.' },
    tip:'Rond de €40.000–€45.000 is de marginale druk het hoogst door de gecombineerde afbouw van arbeidskorting én zorgtoeslag. Extra lijfrente of pensioen storten verlaagt dit.' },
];

interface Props { onClose: () => void; onGetStarted: () => void; onOpenTab: (tab: Tab) => void; }

function useInView(threshold = 0.08) {
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
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null; let raf: number;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function rv(on: boolean, delay = 0, distance = 20): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : `translateY(${distance}px)`,
    filter: on ? 'blur(0px)' : 'blur(5px)',
    transition: `opacity 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  };
}

function HudCorners({ color = '#00d4ff', size = 14, thickness = 1 }: { color?: string; size?: number; thickness?: number }) {
  const s: React.CSSProperties = { position: 'absolute', width: size, height: size };
  const b = `${thickness}px solid ${color}`;
  return (
    <>
      <span style={{ ...s, top: 0, left: 0, borderTop: b, borderLeft: b }} />
      <span style={{ ...s, top: 0, right: 0, borderTop: b, borderRight: b }} />
      <span style={{ ...s, bottom: 0, left: 0, borderBottom: b, borderLeft: b }} />
      <span style={{ ...s, bottom: 0, right: 0, borderBottom: b, borderRight: b }} />
    </>
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
  const moduleCount = useCountUp(13, 900, heroReady);

  useEffect(() => { const id = setTimeout(() => setHeroReady(true), 80); return () => clearTimeout(id); }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto text-slate-200 antialiased" style={{ background: '#050508', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Cyber grid overlay ── */}
      <div className="pointer-events-none fixed inset-0 cyber-page-grid" aria-hidden />

      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -right-60 w-[800px] h-[800px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)' }} />
      </div>

      {/* ── Nav ── */}
      <header className="relative z-20 sticky top-0 backdrop-blur-xl border-b" style={{ background: 'rgba(5,5,8,0.85)', borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 rounded bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center" style={{ boxShadow: '0 0 16px rgba(249,115,22,0.4)' }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="font-bold tracking-tight text-white" style={{ fontFamily: "'Syne', system-ui", fontSize: '0.875rem' }}>NL Belasting</span>
            <span className="cyber-mono text-[10px] px-1.5 py-0.5 rounded border" style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.05)' }}>2026</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onGetStarted} className="hidden sm:flex items-center gap-1.5 text-xs font-medium cursor-pointer border rounded-lg px-3 py-1.5 transition-all duration-200" style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.25)', background: 'rgba(0,212,255,0.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.05)'; }}>
              Open de app <ArrowRight size={11} />
            </button>
            <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer" aria-label="Sluiten">
              <X size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 lg:px-10">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="pt-14 pb-20 sm:pt-20 sm:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── Left: copy ── */}
            <div>
              {/* Badge */}
              <div style={rv(heroReady, 0)}>
                <div className="inline-flex items-center gap-2 rounded border px-3 py-1.5 mb-8 cyber-badge" style={{ borderColor: 'rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.06)', color: '#00d4ff' }}>
                  <span className="w-1.5 h-1.5 rounded-full cyber-pulse-dot" style={{ background: '#00d4ff' }} />
                  <span className="cyber-mono text-[10px] tracking-widest uppercase">Systeem actief · Belastingjaar 2026</span>
                </div>
              </div>

              {/* Headline — 3 lines, staggered */}
              <h1 style={{ fontFamily: "'Syne', system-ui", fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.02, margin: 0 }}>
                <span className="block overflow-hidden" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.5rem)', color: '#f0f4f8' }}>
                  <span className="block" style={rv(heroReady, 60)}>Je volledige</span>
                </span>
                <span className="block overflow-hidden" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.5rem)' }}>
                  <span className="block cyber-headline-accent" style={rv(heroReady, 130)}>financiële plaatje</span>
                </span>
                <span className="block overflow-hidden" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.5rem)', color: '#f0f4f8' }}>
                  <span className="block" style={rv(heroReady, 200)}>in één scherm.</span>
                </span>
              </h1>

              {/* Subtitle */}
              <div style={rv(heroReady, 290)}>
                <p className="mt-6 text-slate-400 leading-relaxed max-w-lg" style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
                  Box 1 &amp; Box 3, toeslagen, hypotheek, DUO, portfolio en 30-jaar prognose — berekend volgens de officiële regels. Alles lokaal, niets naar een server.
                </p>
              </div>

              {/* Horizontal divider */}
              <div style={rv(heroReady, 360)}>
                <div className="my-7 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.3), transparent)' }} />
                  <span className="cyber-mono text-[10px] tracking-widest" style={{ color: 'rgba(0,212,255,0.5)' }}>KERN DATA</span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.3))' }} />
                </div>
              </div>

              {/* Stats */}
              <div style={rv(heroReady, 400)}>
                <div className="grid grid-cols-4 gap-2 mb-8">
                  {[
                    { v: `${moduleCount}`, l: 'modules' },
                    { v: '30j',  l: 'prognose' },
                    { v: '0',    l: 'cloud data' },
                    { v: '∞',    l: "scenario's" },
                  ].map(s => (
                    <div key={s.l} className="relative p-3 rounded border text-center" style={{ borderColor: 'rgba(0,212,255,0.15)', background: 'rgba(0,212,255,0.03)' }}>
                      <HudCorners color="rgba(0,212,255,0.4)" size={6} />
                      <div className="cyber-mono font-bold text-white text-xl leading-none">{s.v}</div>
                      <div className="cyber-mono mt-1 leading-none" style={{ fontSize: '0.6rem', color: 'rgba(0,212,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div style={rv(heroReady, 480)}>
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={onGetStarted}
                    className="group flex items-center gap-2 font-bold text-sm rounded-lg px-6 py-3 cursor-pointer border transition-all duration-200"
                    style={{ fontFamily: "'Syne', system-ui", background: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.5)', color: '#f97316', boxShadow: '0 0 20px rgba(249,115,22,0.15)' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(249,115,22,0.18)'; el.style.boxShadow = '0 0 30px rgba(249,115,22,0.3)'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(249,115,22,0.1)'; el.style.boxShadow = '0 0 20px rgba(249,115,22,0.15)'; }}>
                    Aan de slag
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <a href="#features" className="text-sm font-medium px-4 py-3 transition-colors" style={{ color: 'rgba(0,212,255,0.7)' }}>
                    Bekijk modules ↓
                  </a>
                </div>
              </div>
            </div>

            {/* ── Right: holographic screenshot ── */}
            <div style={rv(heroReady, 200)} className="relative flex items-center justify-center lg:justify-end">
              <div className="relative cyber-float w-full max-w-[540px]">

                {/* Glow beneath frame */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-10 rounded-full pointer-events-none" style={{ background: 'rgba(0,212,255,0.2)', filter: 'blur(24px)' }} />

                {/* Browser frame */}
                <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(0,212,255,0.3)', boxShadow: '0 0 0 1px rgba(0,212,255,0.1), 0 0 40px rgba(0,212,255,0.15), 0 0 80px rgba(0,212,255,0.06), 0 24px 60px rgba(0,0,0,0.6)' }}>
                  <HudCorners color="rgba(0,212,255,0.8)" size={16} />

                  {/* Chrome bar */}
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(0,212,255,0.07)', borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,59,48,0.7)' }} />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,196,0,0.7)' }} />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(40,205,65,0.7)' }} />
                    </div>
                    <div className="flex-1 flex items-center gap-2 rounded px-2 py-0.5" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
                      <span className="w-1.5 h-1.5 rounded-full cyber-pulse-dot" style={{ background: '#22c55e', flexShrink: 0 }} />
                      <span className="cyber-mono text-[10px]" style={{ color: 'rgba(0,212,255,0.6)' }}>nl-belasting.app</span>
                    </div>
                    <span className="cyber-mono text-[9px] tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>LIVE</span>
                  </div>

                  {/* Screenshot */}
                  <div className="relative overflow-hidden" style={{ background: '#050508' }}>
                    <img src={homescreenSrc} alt="NL Belasting Calculator scherm" className="w-full block" style={{ display: 'block' }} />
                    {/* Scan line */}
                    <div className="screen-scanline pointer-events-none" />
                    {/* Vignette */}
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent 70%, rgba(5,5,8,0.4) 100%)' }} />
                    {/* Subtle scanline texture */}
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.012) 3px, rgba(0,212,255,0.012) 4px)' }} />
                  </div>
                </div>

                {/* Corner decorations outside frame */}
                <div className="absolute -top-3 -right-3 cyber-mono text-[9px] tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>SYS.OK</div>
                <div className="absolute -bottom-3 -left-3 cyber-mono text-[9px] tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>v1.15</div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MODULES ━━━━━━━━━━━━━━━━━━━ */}
        <section id="features" className="py-16 sm:py-20" style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }} ref={featRef}>
          <div className="max-w-2xl mb-12" style={rv(featInView, 0)}>
            <div className="cyber-mono text-[10px] tracking-widest uppercase mb-3" style={{ color: '#f97316' }}>// modules</div>
            <h2 style={{ fontFamily: "'Syne', system-ui", fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', letterSpacing: '-0.02em', color: '#f0f4f8', margin: 0 }}>
              Dertien tabs. Eén consistent model.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed" style={{ fontSize: '0.9rem' }}>
              Elke tab voedt dezelfde berekeningsmotor — geen losse spreadsheets, geen dubbele invoer. Klik op een module voor uitleg en een voorbeeld.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: '1rem', overflow: 'hidden' }}>
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const isSel = selected === mod.id;
              return (
                <button key={mod.id} onClick={() => setSelected(isSel ? null : mod.id)}
                  className="text-left p-5 group cursor-pointer border-0 w-full transition-all duration-200 relative"
                  style={{
                    background: isSel ? 'rgba(0,212,255,0.05)' : 'rgba(5,5,8,0.95)',
                    opacity: featInView ? 1 : 0,
                    transform: featInView ? 'translateY(0)' : 'translateY(10px)',
                    filter: featInView ? 'blur(0)' : 'blur(3px)',
                    transition: `opacity 400ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i*30,360)+80}ms, transform 400ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i*30,360)+80}ms, filter 400ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i*30,360)+80}ms, background 150ms ease`,
                    boxShadow: isSel ? 'inset 0 0 0 1px rgba(0,212,255,0.2)' : 'none',
                  }}>
                  {isSel && <HudCorners color="rgba(0,212,255,0.6)" size={10} />}
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center transition-all duration-200 ${isSel ? mod.accentColor : 'text-slate-500 group-hover:text-slate-300'}`}
                      style={{ background: isSel ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isSel ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)'}`, transform: isSel ? 'scale(1.1)' : 'scale(1)' }}>
                      <Icon size={14} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">{mod.emoji} {mod.name}</span>
                        <ChevronRight size={11} className={`transition-transform duration-200 ${isSel ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} style={{ color: isSel ? '#00d4ff' : '#475569' }} />
                      </div>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: isSel ? 'rgba(0,212,255,0.7)' : '#64748b' }}>{mod.tagline}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {detail && (
            <div key={detail.id} className="mt-4 overflow-hidden about-detail-enter relative" style={{ border: '1px solid rgba(0,212,255,0.15)', borderRadius: '1rem', background: 'linear-gradient(135deg, rgba(0,212,255,0.03) 0%, rgba(5,5,8,0.98) 60%)' }}>
              <HudCorners color="rgba(0,212,255,0.5)" size={18} />
              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center about-icon-pop ${detail.accentColor}`}
                      style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)' }}>
                      <detail.icon size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-lg">{detail.emoji} {detail.name}</div>
                      <p className={`text-sm mt-0.5 ${detail.accentColor}`}>{detail.tagline}</p>
                    </div>
                  </div>
                  <button onClick={() => onOpenTab(detail.id)}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-bold cursor-pointer border rounded-lg px-4 py-2 transition-all duration-200"
                    style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.07)' }}>
                    Open tab <ArrowRight size={11} />
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <div className="cyber-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>// uitleg</div>
                      {detail.description.map((p, i) => <p key={i} className="text-sm text-slate-400 leading-relaxed mb-3">{p}</p>)}
                    </div>
                    <div>
                      <div className="cyber-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>// invoervelden</div>
                      <ul className="space-y-1.5">
                        {detail.inputs.map(inp => (
                          <li key={inp} className="flex items-center gap-2 text-sm text-slate-400">
                            <span className="cyber-mono text-[10px]" style={{ color: '#00d4ff' }}>›</span>{inp}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {detail.formula && (
                      <div>
                        <div className="cyber-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(0,212,255,0.5)' }}>// formule</div>
                        <div className={`cyber-mono text-[11px] rounded-lg px-3 py-2 border leading-relaxed ${detail.formulaColor}`}>{detail.formula}</div>
                      </div>
                    )}
                    <div className="rounded-xl p-4" style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}>
                      <div className="cyber-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(0,212,255,0.5)' }}>// pro tip</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{detail.tip}</p>
                    </div>
                  </div>
                  <div>
                    <div className="cyber-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,212,255,0.5)' }}>// voorbeeld</div>
                    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(3,3,6,0.9)', border: '1px solid rgba(0,212,255,0.1)' }}>
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,212,255,0.08)', background: 'rgba(0,212,255,0.03)' }}>
                        <p className="text-xs text-slate-400 italic">{detail.example.scenario}</p>
                      </div>
                      <div className="divide-y" style={{ borderColor: 'rgba(0,212,255,0.06)' }}>
                        {detail.example.steps.map((step, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ background: step.accent ? 'rgba(0,212,255,0.03)' : undefined }}>
                            <span className="text-xs text-slate-500">{step.label}</span>
                            <span className={`cyber-mono text-xs tabular-nums ${step.accent ? `font-bold ${detail.accentColor}` : 'text-slate-300'}`}>{step.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(0,212,255,0.08)', background: 'rgba(0,212,255,0.03)' }}>
                        <p className="text-xs text-slate-400 leading-relaxed">{detail.example.result}</p>
                      </div>
                    </div>
                    <button onClick={() => onOpenTab(detail.id)}
                      className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium cursor-pointer rounded-xl py-3 transition-all duration-200"
                      style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.04)' }}>
                      Open de {detail.name}-tab <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CALCULATIONS ━━━━━━━━━━━━━━━━━━━━ */}
        <section className="py-16 sm:py-20" style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }} ref={calcRef}>
          <div className="max-w-2xl mb-12" style={rv(calcInView, 0)}>
            <div className="cyber-mono text-[10px] tracking-widest uppercase mb-3" style={{ color: 'rgba(139,92,246,0.8)' }}>// berekeningen</div>
            <h2 style={{ fontFamily: "'Syne', system-ui", fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', letterSpacing: '-0.02em', color: '#f0f4f8', margin: 0 }}>
              Hoe de cijfers tot stand komen.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed text-sm">Alle formules volgen de officiële belastingregels voor 2026.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { col:'#3b82f6', Icon:Calculator, title:'Box 1 — inkomen', items:['Bruto loon + freelance − pensioenpremies − lijfrenteaftrek','EWF bovenop, − hypotheekrente (HRA)','Wet Hillen kapt aftrek af bij volledig afgelost','Drie schijven (35,82% / 37,48% / 49,5%)','Algemene heffingskorting + arbeidskorting'], formula:'netto = (inkomen × schijftarief) − heffingskortingen', fCol:'text-blue-300/80 bg-blue-500/[0.05] border-blue-500/10', delay:0 },
              { col:'#8b5cf6', Icon:LineChart,  title:'Box 3 — vermogen', items:['Overgangsstelsel 2026 — fictief rendement per categorie','Spaargeld 1,03% — beleggingen 5,88% — schulden 2,62%','Heffingvrij vermogen €57.684 (€115.368 partners)','Tarief 36% over fictieve grondslag'], formula:'belasting = (Σ tarief × bezit) × 36%', fCol:'text-violet-300/80 bg-violet-500/[0.05] border-violet-500/10', delay:80 },
              { col:'#14b8a6', Icon:Gift,       title:'Toeslagen', items:['Zorgtoeslag — normpremie minus drempelpercentage × inkomen','Huurtoeslag — bij maandhuur onder grens en inkomen-eligible','HRA — belastingvoordeel hypotheekrente in Box 1'], formula:'zorgtoeslag = max(0, min(max, norm − 0,0575 × inkomen))', fCol:'text-teal-300/80 bg-teal-500/[0.05] border-teal-500/10', delay:160 },
              { col:'#f97316', Icon:TrendingUp, title:'Prognose — netto vermogen', items:['Spaarsaldo groeit met spaarrente + maandelijkse inleg','Beleggingen groeien met aangenomen rendement','Hypotheek volgt aflossingsschema','DUO-saldo o.b.v. inkomen + draagkracht','WOZ-waarde als constante actief · afschrijvingsreserve trekt af'], formula:'netto = spaar + beleg + WOZ − schulden − reserve', fCol:'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10', delay:240 },
            ].map(({ col, Icon, title, items, formula, fCol, delay }) => (
              <article key={title} className="relative overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:border-opacity-30"
                style={{ ...rv(calcInView, delay + 100), background: 'rgba(7,7,14,0.9)', border: `1px solid rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},0.15)` }}>
                <HudCorners color={`${col}55`} size={12} />
                <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${col}15 0%, transparent 70%)` }} />
                <div className="relative">
                  <div className="flex items-center gap-2.5 mb-5">
                    <Icon size={15} style={{ color: col }} />
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-400">
                    {items.map(item => (
                      <li key={item} className="flex gap-2">
                        <span className="cyber-mono text-[10px] mt-0.5 shrink-0" style={{ color: col }}>›</span>{item}
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-5 cyber-mono text-[11px] rounded-lg px-3 py-2 border leading-relaxed ${fCol}`}>{formula}</div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TRUST ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="py-16 sm:py-20" style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }} ref={trustRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { Icon:Lock,     title:'Privacy by design',  body:'Alle data blijft in jouw browser via localStorage. Geen account, geen server, geen tracking.', col:'#22c55e', delay:0 },
              { Icon:Zap,      title:'Realtime alles',     body:'Elke wijziging herberekent direct. Geen "submit", geen wachten — gewoon scrollen en zien.', col:'#00d4ff', delay:80 },
              { Icon:Sparkles, title:'Export & import',    body:"Bewaar volledige scenario's als JSON. Vergelijk wat-als situaties zonder data te verliezen.", col:'#f97316', delay:160 },
            ].map(({ Icon, title, body, col, delay }) => (
              <div key={title} className="relative overflow-hidden rounded-2xl p-7 transition-all duration-300 group"
                style={{ ...rv(trustInView, delay), background: 'rgba(7,7,14,0.9)', border: `1px solid rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},0.15)` }}>
                <HudCorners color={`${col}50`} size={10} />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" style={{ background: `radial-gradient(circle at 50% 0%, ${col}08 0%, transparent 60%)` }} />
                <Icon size={15} className="mb-4 relative" style={{ color: col }} />
                <h3 className="text-sm font-semibold text-white mb-2 relative">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed relative">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="py-16 sm:py-24" style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }} ref={ctaRef}>
          <div className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center" style={{ ...rv(ctaInView, 0), border: '1px solid rgba(0,212,255,0.15)', background: 'rgba(5,5,10,0.95)' }}>
            <HudCorners color="rgba(0,212,255,0.5)" size={24} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,212,255,0.07) 0%, transparent 60%)' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 40% 40% at 50% 100%, rgba(249,115,22,0.06) 0%, transparent 60%)' }} />
            <div className="relative">
              <div className="cyber-mono text-[10px] tracking-widest uppercase mb-6" style={{ color: 'rgba(0,212,255,0.5)' }}>// klaar om te starten?</div>
              <h2 style={{ fontFamily: "'Syne', system-ui", fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3.5rem)', letterSpacing: '-0.03em', color: '#f0f4f8', margin: '0 0 1.25rem' }}>
                Klaar om de cijfers<br />
                <span style={{ color: 'rgba(0,212,255,0.7)' }}>te zien?</span>
              </h2>
              <p className="text-slate-400 leading-relaxed mb-10 max-w-lg mx-auto text-sm">
                Geen registratie nodig. Vul je gegevens in op de tabs — resultaten verschijnen live aan de rechterkant.
              </p>
              <button onClick={onGetStarted}
                className="group inline-flex items-center gap-2 font-bold text-sm rounded-xl px-8 py-4 cursor-pointer border transition-all duration-200"
                style={{ fontFamily: "'Syne', system-ui", background: 'rgba(0,212,255,0.1)', borderColor: 'rgba(0,212,255,0.4)', color: '#00d4ff', boxShadow: '0 0 30px rgba(0,212,255,0.12)' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(0,212,255,0.18)'; el.style.boxShadow = '0 0 50px rgba(0,212,255,0.25)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(0,212,255,0.1)'; el.style.boxShadow = '0 0 30px rgba(0,212,255,0.12)'; }}>
                Open de app
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        <footer className="py-10 text-center" style={{ borderTop: '1px solid rgba(0,212,255,0.06)' }}>
          <p className="cyber-mono text-[11px]" style={{ color: 'rgba(0,212,255,0.25)' }}>
            Indicatieve berekening o.b.v. belastingregels 2026. Geen vervanging voor professioneel advies.
          </p>
        </footer>
      </main>
    </div>
  );
}
