import { useState } from 'react';
import {
  ArrowRight, BarChart3, Calculator, Coins, Database, FileText, Gift,
  Home, LineChart, Lock, PieChart, Shield, Sparkles, TrendingUp, Wallet, X, Zap,
  ChevronRight, BookOpen, BarChart2,
} from 'lucide-react';

type Tab = 'income' | 'woon' | 'waardes' | 'expenses' | 'schulden' | 'bank' | 'portfolio' | 'afschrijvingen' | 'jaarruimte' | 'prognose' | 'results' | 'marginale';

interface ExampleStep { label: string; value: string; accent?: boolean }
interface ModuleDetail {
  id: Tab;
  icon: React.ElementType;
  name: string;
  emoji: string;
  accentColor: string;
  glowColor: string;
  tagline: string;
  description: string[];
  inputs: string[];
  example: { scenario: string; steps: ExampleStep[]; result: string };
  formula?: string;
  formulaColor?: string;
  tip: string;
}

const MODULES: ModuleDetail[] = [
  {
    id: 'income',
    icon: Wallet,
    name: 'Inkomen',
    emoji: '💼',
    accentColor: 'text-sky-400',
    glowColor: 'bg-sky-500/10',
    tagline: 'Bruto naar netto — alle Box 1 bronnen in één scherm.',
    description: [
      'Vul je bruto inkomen in uit alle bronnen: vast dienstverband, freelance, huurinkomsten of andere Box 1 inkomsten. De tool berekent automatisch de belastingschijven en heffingskortingen.',
      'Pensioenpremies en lijfrentepremies verlagen je belastbaar inkomen, zodat je direct ziet hoeveel minder belasting je betaalt door fiscaal gunstig te sparen.',
    ],
    inputs: ['Bruto jaarsalaris', 'Freelance/ZZP inkomen', 'Huurinkomsten', 'Overig Box 1', 'Werknemerspensioenpremie', 'Lijfrenteaftrek'],
    example: {
      scenario: 'Salariswerknemer, €65.000 bruto, pensioenpremie €5.500',
      steps: [
        { label: 'Bruto inkomen',         value: '€ 65.000' },
        { label: '− pensioenpremie',       value: '− € 5.500' },
        { label: 'Belastbaar Box 1',       value: '€ 59.500' },
        { label: 'Schijf 1 (≤€38.441)',    value: '€ 13.770  (35,82%)' },
        { label: 'Schijf 2 (€38.441–€76.817)', value: '€ 7.898  (37,48%)' },
        { label: '− Algemene heffingskorting', value: '− € 1.882' },
        { label: '− Arbeidskorting',       value: '− € 2.214' },
        { label: 'Netto te betalen',       value: '€ 17.572', accent: true },
      ],
      result: 'Netto jaarinkomen ≈ € 41.928 (€ 3.494 / maand)',
    },
    formula: 'belastbaar = brutoloon + freelance − pensioenpremie − lijfrenteaftrek',
    formulaColor: 'text-sky-300/80 bg-sky-500/[0.05] border-sky-500/10',
    tip: 'Elke extra euro lijfrente verlaagt je belastbaar inkomen in de hoogste schijf — bij €59.500 is dat 37,48% voordeel per ingelegde euro.',
  },
  {
    id: 'woon',
    icon: Home,
    name: 'Wonen',
    emoji: '🏠',
    accentColor: 'text-orange-400',
    glowColor: 'bg-orange-500/10',
    tagline: 'Huur of koop — inclusief EWF, HRA en Wet Hillen.',
    description: [
      'Bij een eigen woning bepaal je het type hypotheek (annuïteit of lineair), het rentepercentage en de WOZ-waarde. De tool berekent het eigenwoningforfait (EWF) en de hypotheekrenteaftrek (HRA).',
      'Wet Hillen: als je hypotheek volledig (of bijna) is afgelost, is de hypotheekrente kleiner dan het EWF. In dat geval kapt de Wet Hillen de belasting over het EWF af.',
    ],
    inputs: ['Woningtype (huur / hypotheek)', 'WOZ-waarde', 'Hypotheekbedrag & rente', 'Hypotheekvorm (annuïteit/lineair)', 'Looptijd & startjaar', 'GWE, VvE, overig'],
    example: {
      scenario: 'Eigen woning, WOZ €350.000, hypotheek €280.000 @ 3,8%',
      steps: [
        { label: 'WOZ-waarde',                value: '€ 350.000' },
        { label: 'Eigenwoningforfait (0,35%)',  value: '+ € 1.225' },
        { label: 'Hypotheekrente (jaar 1)',     value: '€ 10.640' },
        { label: 'Hypotheekrenteaftrek',        value: '− € 10.640' },
        { label: 'Netto aftrek eigen woning',   value: '− € 9.415', accent: true },
      ],
      result: 'Belastingbesparing ≈ € 3.527 /jaar (bij 37,48% tarief)',
    },
    formula: 'EWF = WOZ × 0,35%  |  HRA = rente × schijftarief  |  Wet Hillen: aftrek = max(0, HRA − EWF)',
    formulaColor: 'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10',
    tip: 'WOZ-waarde telt ook mee als actief in je netto vermogen in de Prognose — maar niet in Box 3.',
  },
  {
    id: 'waardes',
    icon: Database,
    name: 'Waardes 1 jan',
    emoji: '📋',
    accentColor: 'text-violet-400',
    glowColor: 'bg-violet-500/10',
    tagline: 'Box 3 peildatum bezittingen — spaargeld, beleggingen, betaalrekeningen.',
    description: [
      'Box 3 wordt belast op basis van de stand op 1 januari. Hier vul je alle bezittingen in die je op die datum had. Schulden voer je in bij de Schulden-tab.',
      'Het overgangsstelsel 2026 gebruikt forfaitaire rendementen per categorie: spaargeld rendeert fictief 1,03%, beleggingen 5,88%. Na aftrek van het heffingsvrijvermogen (€57.684) betaal je 36% over de fictieve grondslag.',
    ],
    inputs: ['Beleggingsrekeningen (naam + saldo)', 'Spaarrekeningen (naam + saldo)', 'Betaalrekeningen (naam + saldo)'],
    example: {
      scenario: 'Spaar €40.000 + beleggingen €60.000, geen schulden',
      steps: [
        { label: 'Spaargeld (1,03%)',          value: '€ 412' },
        { label: 'Beleggingen (5,88%)',         value: '€ 3.528' },
        { label: 'Totaal fictief rendement',    value: '€ 3.940' },
        { label: '− Heffingsvrijvermogen',      value: '− € 57.684 × (100k/100k) = ÷ alles' },
        { label: 'Grondslag (100k > vrijstelling)', value: '€ 3.940 × (42.316/100.000)' },
        { label: 'Box 3 belasting (36%)',       value: '€ 535', accent: true },
      ],
      result: 'Effectief Box 3 tarief ≈ 0,54% over totaal vermogen',
    },
    formula: 'grondslag = Σ(bezitting × forfait) − Σ(schuld × 2,62%)  →  × 36%',
    formulaColor: 'text-violet-300/80 bg-violet-500/[0.05] border-violet-500/10',
    tip: 'Alleen de peildatum-stand telt. Geld dat je ná 1 januari ontvangt, valt pas volgend jaar in Box 3.',
  },
  {
    id: 'expenses',
    icon: FileText,
    name: 'Kosten',
    emoji: '🛒',
    accentColor: 'text-rose-400',
    glowColor: 'bg-rose-500/10',
    tagline: 'Maandelijkse uitgaven, spaar- en beleggingsbijdragen.',
    description: [
      'Vul je vaste en variabele maandelijkse kosten in. De tool berekent je netto besteedbaar inkomen en laat zien welk percentage je spaart of belegt.',
      'De maandelijkse spaar- en beleggingsbedragen worden ook meegenomen in de 30-jaar Prognose, zodat je direct ziet wat het effect is van meer of minder inleggen.',
    ],
    inputs: ['Boodschappen', 'Transport', 'Verzekeringen', 'Zorg & gezondheid', 'Onderwijs', 'Vrije tijd & uit eten', 'Overig', 'Maandelijks sparen', 'Maandelijks beleggen'],
    example: {
      scenario: 'Netto inkomen €3.500/m, vaste kosten €2.200',
      steps: [
        { label: 'Netto maandinkomen',     value: '€ 3.500' },
        { label: '− Boodschappen',         value: '− € 500' },
        { label: '− Transport',            value: '− € 300' },
        { label: '− Verzekeringen',        value: '− € 250' },
        { label: '− Overig kosten',        value: '− € 650' },
        { label: 'Maandelijks sparen',     value: '€ 500' },
        { label: 'Maandelijks beleggen',   value: '€ 300' },
        { label: 'Beschikbaar na alles',   value: '€ 0', accent: true },
      ],
      result: 'Spaarquote: 23% van netto inkomen — ruim boven het nationale gemiddelde',
    },
    tip: 'Verhoog je maandelijkse belegging met €100 en kijk direct in Prognose hoeveel eerder je FIRE kunt bereiken.',
  },
  {
    id: 'schulden',
    icon: Coins,
    name: 'Schulden',
    emoji: '💳',
    accentColor: 'text-amber-400',
    glowColor: 'bg-amber-500/10',
    tagline: 'DUO-leningen met draagkrachtberekening, beleggingsschulden.',
    description: [
      'DUO-schulden worden afgelost op basis van draagkracht: een percentage van je inkomen boven een drempel. De tool ondersteunt zowel het oude stelsel (SF15, 4% boven drempel) als het nieuwe stelsel (SF35, 3,5% over 35 jaar).',
      'Beleggingsschulden zijn aftrekbaar in Box 3, wat je Box 3 belasting verlaagt. Je ziet direct het gecombineerde effect op de belastingberekening.',
    ],
    inputs: ['DUO startbedrag & huidig saldo', 'Stelsel (SF15 / SF35)', 'DUO rentepercentage', 'Beleggingsleningen (naam + bedrag + rente)'],
    example: {
      scenario: 'DUO schuld €28.000 @ 2,56%, SF15, inkomen €42.000',
      steps: [
        { label: 'DUO schuld',              value: '€ 28.000' },
        { label: 'DUO rente',               value: '2,56%' },
        { label: 'Draagkrachtbasis SF15',   value: '4% × max(0, inkomen − drempel)' },
        { label: 'Jaarlijkse aflossing',    value: '≈ € 880 /jaar' },
        { label: 'Restschuld na 15 jaar',   value: '≈ € 17.800', accent: true },
        { label: 'Box 3 aftrek schuld',     value: '2,62% × €28.000 = −€734' },
      ],
      result: 'DUO telt niet mee als Box 3 aftrekpost — alleen beleggingsleningen doen dat.',
    },
    tip: 'DUO-schulden zijn niet aftrekbaar in Box 3, maar beleggingsleningen wel. Houd dat onderscheid in de gaten.',
  },
  {
    id: 'bank',
    icon: BarChart3,
    name: 'Bankrekeningen',
    emoji: '🏦',
    accentColor: 'text-teal-400',
    glowColor: 'bg-teal-500/10',
    tagline: 'Actuele saldi — los van de Box 3 peildatum.',
    description: [
      'Hier vul je de huidige standen in van je spaar- en betaalrekeningen. Dit is het geld dat je nu hebt, los van wat je op 1 januari (Box 3 peildatum) had.',
      'Het huidige saldo telt mee in je netto vermogen vandaag en in de Prognose. De spaarrente die je hier invoert, wordt gebruikt om het saldo te laten groeien over de jaren.',
    ],
    inputs: ['Naam rekening', 'Huidig saldo', 'Spaarrente (% /jaar)', 'Betaalrekening saldo'],
    example: {
      scenario: 'ING spaarrekening €22.000 @ 2,1%, betaalrekening €3.500',
      steps: [
        { label: 'Spaarrekening saldo',    value: '€ 22.000' },
        { label: 'Rente per jaar (2,1%)',   value: '+ € 462' },
        { label: 'Betaalrekening',         value: '€ 3.500' },
        { label: 'Totaal huidig bankgeld', value: '€ 25.500', accent: true },
        { label: 'Na 1 jaar (geen inleg)', value: '€ 25.962' },
      ],
      result: 'Banksaldo groeit mee in de Prognose inclusief maandelijkse spaarbijdragen uit de Kosten-tab.',
    },
    tip: 'Houd betaalrekeningen en spaarrekeningen gescheiden — betaalrekeningen tellen niet mee voor rente-berekeningen in de prognose.',
  },
  {
    id: 'portfolio',
    icon: PieChart,
    name: 'Portfolio',
    emoji: '📈',
    accentColor: 'text-emerald-400',
    glowColor: 'bg-emerald-500/10',
    tagline: 'Transacties, FIFO-koerswinst, live koersen.',
    description: [
      'Voeg al je beleggingstransacties toe: aankopen, verkopen en dividenduitkeringen. De tool berekent de FIFO-koerswinst (gerealiseerd én ongerealiseerd) en haalt live koersen op.',
      'De huidige portefeuillewaarde telt mee in je netto vermogen en in de Prognose. Box 3 peildatumsaldi voer je separaat in bij "Waardes 1 jan".',
    ],
    inputs: ['Transactiedatum', 'Ticker / ISIN', 'Aantal aandelen / units', 'Aankoopprijs per stuk', 'Type (koop / verkoop / dividend)'],
    example: {
      scenario: '100× VWRL aangekocht jan 2023 @ €85, koers nu €112',
      steps: [
        { label: 'Aankoopwaarde',           value: '€ 8.500' },
        { label: 'Huidige waarde',          value: '€ 11.200' },
        { label: 'Ongerealiseerde winst',   value: '+ € 2.700', accent: true },
        { label: 'FIFO kostprijs',          value: '€ 85,00 / stuk' },
        { label: 'Bij verkoop 50 aandelen', value: 'winst = 50 × (€112 − €85) = €1.350' },
      ],
      result: 'Koerswinst is in Nederland onbelast — dividend wordt belast via fictief rendement in Box 3.',
    },
    tip: 'In Nederland is koerswinst onbelast. Aandelen tellen mee in Box 3 met forfaitair rendement van 5,88% op de 1-jan-waarde.',
  },
  {
    id: 'afschrijvingen',
    icon: Shield,
    name: 'Afschrijvingen',
    emoji: '🔄',
    accentColor: 'text-slate-300',
    glowColor: 'bg-slate-500/10',
    tagline: 'Sinking fund calculator voor toekomstige vervanging.',
    description: [
      'Grote uitgaven komen altijd: een nieuwe auto, vervanging van witgoed, dak, ketel. De afschrijvingensectie berekent per categorie hoeveel je elke maand opzij moet zetten om die kosten te kunnen dragen.',
      'De opgebouwde reserve wordt afgetrokken van je netto vermogen — want dat geld is al "beloofd" aan een toekomstige uitgave. Zo krijg je een realistisch beeld van je beschikbaar vrij vermogen.',
    ],
    inputs: ['Categorienaam (bijv. Auto)', 'Vervangingswaarde', 'Resterende levensduur (jaar)', 'Rente op reserve (%)'],
    example: {
      scenario: 'Auto €22.000 vervangen na 7 jaar, reserve @ 3%',
      steps: [
        { label: 'Vervangingswaarde',       value: '€ 22.000' },
        { label: 'Levensduur',              value: '7 jaar' },
        { label: 'Reserve rente',           value: '3% /jaar' },
        { label: 'Vereiste maandinleg',     value: '€ 245 /maand', accent: true },
        { label: 'Totaal gereserveerd',     value: '€ 20.580 + rente = €22.000' },
      ],
      result: 'Gereserveerd bedrag trekt van je netto vermogen af in de prognose — realistischer dan zonder.',
    },
    tip: 'Voeg ook ketel, dak en witgoed toe. Een gemiddeld huishouden heeft €300–500/m aan sinking fund nodig voor realistisch vermogensbeheer.',
  },
  {
    id: 'jaarruimte',
    icon: BookOpen,
    name: 'Jaarruimte',
    emoji: '🏛️',
    accentColor: 'text-amber-400',
    glowColor: 'bg-amber-500/10',
    tagline: 'Fiscale lijfrente- en bankspaarruimte 2026.',
    description: [
      'De jaarruimte is hoeveel je fiscaal aftrekbaar mag inleggen in een lijfrenteverzekering of bankspaarproduct. Je betaalt nu minder belasting en belegt voor later.',
      'De formule is 30% van je premiegrondslag (inkomen − AOW franchise €19.172) minus Factor A (de pensioenopbouw van je werkgever). Onbenutte ruimte van de afgelopen 7 jaar mag je inhalen als reserveringsruimte (max €40.248).',
    ],
    inputs: ['Bruto inkomen', 'Factor A (jaarlijkse pensioenaangroei × 7,5)', 'Reserveringsruimte (voorgaande jaren)'],
    example: {
      scenario: 'Inkomen €65.000, Factor A €1.400, geen reserveringsruimte',
      steps: [
        { label: 'Grondslag (inkomen − franchise)', value: '€ 65.000 − €19.172 = €45.828' },
        { label: '30% van grondslag',           value: '€ 13.748' },
        { label: '− Factor A',                  value: '− € 1.400' },
        { label: 'Jaarruimte 2026',             value: '€ 12.348', accent: true },
        { label: 'Belastingvoordeel @ 37,48%',  value: '€ 4.626 bespaard' },
      ],
      result: 'Door €12.348 in een lijfrente te storten bespaar je €4.626 aan belasting dit jaar.',
    },
    formula: 'jaarruimte = max(0, 30% × (inkomen − €19.172) − Factor A)',
    formulaColor: 'text-amber-300/80 bg-amber-500/[0.05] border-amber-500/10',
    tip: 'Factor A vraag je op bij je pensioenfonds of werkgever. Het staat ook op je UPO (Uniform Pensioenoverzicht).',
  },
  {
    id: 'prognose',
    icon: TrendingUp,
    name: 'Prognose',
    emoji: '🔮',
    accentColor: 'text-orange-400',
    glowColor: 'bg-orange-500/10',
    tagline: '30-jaar netto vermogensprognose met FIRE-doelstelling.',
    description: [
      'De prognose groeit je huidige vermogen uit over 30 jaar: spaarsaldo met spaarrente + inleg, beleggingen met rendement + maandelijkse inleg, hypotheek volgt het aflossingsschema.',
      'Stel je FIRE-doelstelling in: gewenste SWR (3/3.5/4%), je verwachte jaaruitgaven, AOW-leeftijd en -bedrag. Het FI-jaar wordt berekend als je vermogen de FIRE-drempel overschrijdt. Na FI stopt de inleg en begin je te onttrekken.',
    ],
    inputs: ['Verwacht beleggingsrendement (%)', 'Spaarrente (%)', 'Inkomensstijging (%/jaar)', 'Horizont (10/20/30 jaar)', 'SWR% (3/3,5/4%)', 'AOW-leeftijd & -bedrag'],
    example: {
      scenario: 'Vermogen €120.000, inleg €700/m belegen, rendement 7%, uitgaven €2.500/m',
      steps: [
        { label: 'Huidig vermogen',         value: '€ 120.000' },
        { label: 'Maandelijkse inleg',      value: '€ 700 /maand' },
        { label: 'Rendement beleggingen',   value: '7% /jaar' },
        { label: 'FIRE-doelstelling (4%)',  value: '€ 2.500 × 12 / 4% = € 750.000' },
        { label: 'Verwacht FI-jaar',        value: '≈ 2041 (15 jaar)', accent: true },
        { label: 'AOW bij 67 (€1.400/m)',   value: 'Verlaagt onttrekking met €16.800/j' },
      ],
      result: 'Na FI trek je €30.000/jaar op; met AOW daalt dat naar €13.200/jaar vanuit portfolio.',
    },
    formula: 'FIRE = (jaaruitgaven − AOW − pensioen) / SWR%',
    formulaColor: 'text-orange-300/80 bg-orange-500/[0.05] border-orange-500/10',
    tip: 'WOZ-waarde wordt meegeteld als constant actief. Afschrijvingsreserves worden elk jaar afgetrokken — zo zie je je echte vrije vermogen.',
  },
  {
    id: 'results',
    icon: Calculator,
    name: 'Berekening',
    emoji: '🧮',
    accentColor: 'text-blue-400',
    glowColor: 'bg-blue-500/10',
    tagline: 'Volledig belastingoverzicht: Box 1, Box 3, toeslagen.',
    description: [
      'Dit tabblad toont het volledige resultaat van alle invoer: Box 1 belasting per schijf, heffingskortingen, Box 3 vermogensbelasting, zorgtoeslag, huurtoeslag en hypotheekrenteaftrek.',
      'Onderaan zie je het netto beschikbaar inkomen per maand en een overzicht van je netto vermogen inclusief WOZ en afschrijvingsreserve.',
    ],
    inputs: ['(geen invoer — berekend vanuit alle andere tabs)'],
    example: {
      scenario: 'Bruto €65.000, eigen woning WOZ €350k, spaar €40k, beleg €60k',
      steps: [
        { label: 'Bruto inkomen',           value: '€ 65.000' },
        { label: '− Box 1 belasting',       value: '− € 21.668' },
        { label: '− Box 3 belasting',       value: '− € 535' },
        { label: '+ Zorgtoeslag',           value: '+ € 0 (te hoog inkomen)' },
        { label: '+ HRA voordeel',          value: '+ € 3.527' },
        { label: 'Netto jaarinkomen',       value: '≈ € 46.324', accent: true },
        { label: 'Netto vermogen nu',       value: 'spaar + beleg + WOZ − schulden' },
      ],
      result: 'Beschikbaar netto: ≈ € 3.860 / maand — na belasting, voor vaste lasten.',
    },
    tip: 'Klik op de euro-bedragen in de schijventabel om te zien hoe de grens precies berekend wordt per schijf.',
  },
  {
    id: 'marginale',
    icon: BarChart2,
    name: 'Marginale Druk',
    emoji: '📊',
    accentColor: 'text-fuchsia-400',
    glowColor: 'bg-fuchsia-500/10',
    tagline: 'Hoeveel houd je over van elke extra verdiende euro?',
    description: [
      'De marginale druk is het percentage dat je kwijt bent van de volgende euro die je verdient. Door afbouw van heffingskortingen en zorgtoeslag kan dit boven de 60% uitkomen — zelfs bij een modaal inkomen.',
      'De grafiek toont drie lijnen: effectief tarief (blauw), marginaal tarief incl. kortingenafbouw (oranje) en het gecombineerde effect inclusief zorgtoeslag (teal). Een verticale lijn markeert jouw huidige inkomen.',
    ],
    inputs: ['(geen extra invoer — berekend vanuit inkomen-tab)'],
    example: {
      scenario: 'Inkomen stijgt van €40.000 naar €41.000 — wat houd je netto over?',
      steps: [
        { label: 'Bruto extra inkomen',         value: '€ 1.000' },
        { label: '− Schijftarief 2 (37,48%)',   value: '− € 375' },
        { label: '− Afbouw arbeidskorting',     value: '− € 60' },
        { label: '− Afbouw zorgtoeslag (5,75%)', value: '− € 58' },
        { label: 'Netto over van €1.000',       value: '≈ € 507', accent: true },
        { label: 'Effectief marginaal tarief',  value: '≈ 49,3%' },
      ],
      result: 'Bij €40k inkomen houd je slechts de helft van een loonsverhoging netto over.',
    },
    tip: 'Rond de €40.000–€45.000 is de marginale druk het hoogst door de gecombineerde afbouw van arbeidskorting én zorgtoeslag. Extra lijfrente of pensioen storten verlaagt dit.',
  },
];

interface Props {
  onClose: () => void;
  onGetStarted: () => void;
  onOpenTab: (tab: Tab) => void;
}

export default function AboutPage({ onClose, onGetStarted, onOpenTab }: Props) {
  const [selected, setSelected] = useState<Tab | null>(null);
  const detail = selected ? MODULES.find(m => m.id === selected) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#08080b] text-slate-200 font-sans antialiased"
         style={{ fontFamily: '"Inter", "DM Sans", system-ui, -apple-system, sans-serif' }}>

      {/* ── Decorative orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-violet-600/25 via-fuchsia-500/10 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/15 via-amber-400/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-sky-500/12 via-blue-500/6 to-transparent blur-3xl" />
      </div>

      {/* ── Grid noise overlay ── */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025]" aria-hidden style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── Top nav ── */}
      <header className="relative z-20 sticky top-0 backdrop-blur-xl bg-[#08080b]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">NL Belasting <span className="text-slate-500 font-normal">Pro</span></span>
            <span className="ml-1 text-[10px] font-mono text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">2026</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onGetStarted}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              Open de app <ArrowRight size={12} />
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors bg-transparent border-0 cursor-pointer"
              aria-label="Sluiten"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">

        {/* ── Hero ── */}
        <section className="pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-white/[0.03] border border-white/[0.06] rounded-full px-2.5 py-1 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live berekeningen — belastingjaar 2026
            </div>
            <h1 className="text-5xl lg:text-7xl font-semibold tracking-[-0.03em] text-white leading-[1.02]">
              Je volledige <br />
              <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">financiële plaatje</span>
              <br /> in één scherm.
            </h1>
            <p className="mt-7 text-base lg:text-lg text-slate-400 leading-relaxed max-w-2xl">
              Box 1 &amp; Box 3, toeslagen, hypotheek, DUO, portfolio en 30-jaar prognose —
              berekend volgens de officiële regels van de Nederlandse belastingdienst.
              Alles lokaal, niets naar een server.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                onClick={onGetStarted}
                className="group flex items-center gap-2 bg-white text-black hover:bg-slate-200 transition-colors font-medium text-sm rounded-lg px-5 py-2.5 cursor-pointer border-0"
              >
                Aan de slag
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <a href="#features"
                 className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2.5">
                Bekijk wat het kan ↓
              </a>
            </div>

            {/* Stat strip */}
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
              {[
                { v: '12',  l: 'modules'              },
                { v: '30j', l: 'prognose horizon'     },
                { v: '0',   l: 'data naar de cloud'   },
                { v: '∞',   l: 'scenario-vergelijkingen' },
              ].map(s => (
                <div key={s.l} className="bg-[#0a0a0d] px-5 py-5">
                  <div className="text-2xl font-semibold tabular-nums text-white tracking-tight">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-20 border-t border-white/[0.06]">
          <div className="max-w-2xl mb-14">
            <div className="text-[11px] uppercase tracking-wider text-orange-400 font-medium mb-3">Modules</div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-white">
              Twaalf tabs. Eén consistent model.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Elke tab voedt dezelfde berekeningsmotor — geen losse spreadsheets,
              geen dubbele invoer, geen verrassingen. Klik op een module voor meer uitleg en een voorbeeld.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
            {MODULES.map(mod => {
              const Icon = mod.icon;
              const isSelected = selected === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => setSelected(isSelected ? null : mod.id)}
                  className={`bg-[#0a0a0d] text-left p-6 group transition-colors cursor-pointer border-0 w-full ${
                    isSelected
                      ? 'bg-white/[0.04]'
                      : 'hover:bg-[#0c0c10]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`shrink-0 w-9 h-9 rounded-lg bg-white/[0.04] border flex items-center justify-center transition-colors ${
                      isSelected
                        ? `${mod.accentColor} border-white/20`
                        : `text-slate-300 border-white/[0.06] group-hover:${mod.accentColor} group-hover:border-white/10`
                    }`}>
                      <Icon size={16} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{mod.emoji} {mod.name}</span>
                        <ChevronRight size={12} className={`text-slate-600 transition-transform ${isSelected ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{mod.tagline}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Detail panel ── */}
          {detail && (
            <div className="mt-4 border border-white/[0.08] rounded-2xl overflow-hidden bg-gradient-to-br from-[#0d0d13] to-[#09090d]">
              <div className="relative">
                <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full ${detail.glowColor} blur-3xl pointer-events-none`} />
              </div>
              <div className="relative p-8 lg:p-10">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center ${detail.accentColor}`}>
                      <detail.icon size={22} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{detail.emoji} {detail.name}</div>
                      <p className={`text-sm mt-0.5 ${detail.accentColor}`}>{detail.tagline}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenTab(detail.id)}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-black bg-white hover:bg-slate-200 transition-colors rounded-lg px-4 py-2 cursor-pointer border-0"
                  >
                    Open tab <ArrowRight size={12} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                  {/* Left: description + inputs */}
                  <div className="space-y-6">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-3">Uitleg</div>
                      <div className="space-y-3">
                        {detail.description.map((p, i) => (
                          <p key={i} className="text-sm text-slate-400 leading-relaxed">{p}</p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-3">Invoervelden</div>
                      <ul className="space-y-1.5">
                        {detail.inputs.map(inp => (
                          <li key={inp} className="flex items-center gap-2 text-sm text-slate-400">
                            <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                            {inp}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {detail.formula && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">Formule</div>
                        <div className={`font-mono text-[11px] rounded-lg px-3 py-2 border leading-relaxed ${detail.formulaColor}`}>
                          {detail.formula}
                        </div>
                      </div>
                    )}

                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">Pro tip</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{detail.tip}</p>
                    </div>
                  </div>

                  {/* Right: example */}
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-3">Voorbeeld</div>
                    <div className="bg-[#0a0a0d] border border-white/[0.06] rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                        <p className="text-xs text-slate-400 italic">{detail.example.scenario}</p>
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {detail.example.steps.map((step, i) => (
                          <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${step.accent ? 'bg-white/[0.03]' : ''}`}>
                            <span className="text-xs text-slate-500">{step.label}</span>
                            <span className={`text-xs font-mono tabular-nums ${step.accent ? `font-semibold ${detail.accentColor}` : 'text-slate-300'}`}>
                              {step.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className={`px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]`}>
                        <p className="text-xs text-slate-400 leading-relaxed">{detail.example.result}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenTab(detail.id)}
                      className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] rounded-xl py-3 transition-colors cursor-pointer"
                    >
                      Open de {detail.name}-tab in de app
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Calculations breakdown ── */}
        <section className="py-20 border-t border-white/[0.06]">
          <div className="max-w-2xl mb-14">
            <div className="text-[11px] uppercase tracking-wider text-violet-400 font-medium mb-3">Berekeningen</div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-white">
              Hoe de cijfers tot stand komen.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Onder de motorkap. Alle formules volgen de officiële belastingregels voor 2026.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Box 1 */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <Calculator size={16} className="text-blue-400" />
                  <h3 className="text-base font-semibold text-white">Box 1 — inkomen uit arbeid</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Bruto loon + freelance − pensioenpremies − lijfrenteaftrek</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Eigenwoningforfait (EWF) bovenop, − hypotheekrente (HRA)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Wet Hillen kapt aftrek af bij volledig afgelost</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Drie schijven (35,82% / 37,48% / 49,5%)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Algemene heffingskorting + arbeidskorting</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-blue-300/80 bg-blue-500/[0.05] border border-blue-500/10 rounded-lg px-3 py-2">
                  netto = (inkomen × schijftarief) − heffingskortingen
                </div>
              </div>
            </article>

            {/* Box 3 */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <LineChart size={16} className="text-violet-400" />
                  <h3 className="text-base font-semibold text-white">Box 3 — vermogen</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Overgangsstelsel 2026 — fictief rendement per categorie</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Spaargeld 1,03% — beleggingen 5,88% — schulden 2,62%</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Heffingvrij vermogen €57.684 (€115.368 partners)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Tarief 36% over fictieve grondslag</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Werkelijke rente naast informatief getoond</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-violet-300/80 bg-violet-500/[0.05] border border-violet-500/10 rounded-lg px-3 py-2">
                  belasting = (Σ tarief × bezit) × 36%
                </div>
              </div>
            </article>

            {/* Toeslagen */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-teal-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <Gift size={16} className="text-teal-400" />
                  <h3 className="text-base font-semibold text-white">Toeslagen</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Zorgtoeslag — normpremie minus drempelpercentage × inkomen</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Huurtoeslag — bij maandhuur onder de grens en inkomen-eligible</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> HRA — belastingvoordeel hypotheekrente in Box 1</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Maandbedragen direct zichtbaar naast jaartotaal</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-teal-300/80 bg-teal-500/[0.05] border border-teal-500/10 rounded-lg px-3 py-2">
                  zorgtoeslag = max(0, min(max, norm − 0,0575 × inkomen))
                </div>
              </div>
            </article>

            {/* Prognose */}
            <article className="relative bg-gradient-to-br from-[#0c0c11] to-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-orange-500/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-5">
                  <TrendingUp size={16} className="text-orange-400" />
                  <h3 className="text-base font-semibold text-white">Prognose — netto vermogen</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Spaarsaldo groeit met spaarrente + maandelijkse inleg</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Beleggingen groeien met aangenomen rendement</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> Hypotheek volgt jouw aflossingsschema (annuïteit/lineair)</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> DUO-saldo per jaar berekend o.b.v. inkomen + draagkracht</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> <span className="text-white">WOZ-waarde meegerekend</span> als constante actief</li>
                  <li className="flex gap-2"><span className="text-slate-600">→</span> <span className="text-white">Afschrijvingsreserve</span> trekt geoormerkt geld af</li>
                </ul>
                <div className="mt-5 font-mono text-[11px] text-orange-300/80 bg-orange-500/[0.05] border border-orange-500/10 rounded-lg px-3 py-2">
                  netto = spaar + beleg + WOZ − schulden − reserve
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ── Privacy / Trust ── */}
        <section className="py-20 border-t border-white/[0.06]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Lock,       title: 'Privacy by design',     body: 'Alle data blijft in jouw browser via localStorage. Geen account, geen server, geen tracking.' },
              { icon: Zap,        title: 'Realtime alles',        body: 'Elke wijziging herberekent direct. Geen "submit", geen wachten — gewoon scrollen en zien.' },
              { icon: Sparkles,   title: 'Export & import',       body: 'Bewaar volledige scenario\'s als JSON. Vergelijk wat-als situaties zonder data te verliezen.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-[#0a0a0d] border border-white/[0.06] rounded-2xl p-7">
                <Icon size={16} className="text-orange-400 mb-4" />
                <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 border-t border-white/[0.06]">
          <div className="relative bg-gradient-to-br from-[#0d0d12] to-[#08080b] border border-white/[0.08] rounded-3xl p-12 lg:p-16 overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/20 via-violet-500/10 to-transparent blur-3xl" />
            </div>
            <div className="relative text-center max-w-2xl mx-auto">
              <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-white">
                Klaar om de cijfers <br className="hidden sm:block" />
                <span className="text-slate-500">te zien?</span>
              </h2>
              <p className="mt-5 text-slate-400 leading-relaxed">
                Geen registratie nodig. Vul je gegevens in op de tabs links —
                resultaten verschijnen live aan de rechterkant.
              </p>
              <button
                onClick={onGetStarted}
                className="mt-9 inline-flex items-center gap-2 bg-white text-black hover:bg-slate-200 transition-colors font-medium text-sm rounded-lg px-6 py-3 cursor-pointer border-0"
              >
                Open de app
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        <footer className="py-10 border-t border-white/[0.06] text-center">
          <p className="text-xs text-slate-600">
            Indicatieve berekening o.b.v. belastingregels 2026. Geen vervanging voor professioneel advies.
          </p>
        </footer>
      </main>
    </div>
  );
}
