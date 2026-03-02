/**
 * Seed AdLibraryBrand table with brands from multiple categories.
 *
 * Usage:
 *   npx tsx scripts/seed-brands.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from '../src/lib/prisma';

interface BrandSeed {
  pageId: string;
  pageName: string;
  category: string;
  country?: string;
  website?: string;
}

// Fashion brands (50+)
const fashionBrands: BrandSeed[] = [
  { pageId: '21631697312', pageName: 'LOOKFANTASTIC', category: 'fashion', country: 'GB', website: 'lookfantastic.com' },
  { pageId: '182162001806727', pageName: 'Zara', category: 'fashion', country: 'ES', website: 'zara.com' },
  { pageId: '21415640912', pageName: 'H&M', category: 'fashion', country: 'SE', website: 'hm.com' },
  { pageId: '144166965613718', pageName: 'ASOS', category: 'fashion', country: 'GB', website: 'asos.com' },
  { pageId: '7696705277', pageName: 'Nike', category: 'fashion', country: 'US', website: 'nike.com' },
  { pageId: '26669533972', pageName: 'Adidas', category: 'fashion', country: 'DE', website: 'adidas.com' },
  { pageId: '192341370829829', pageName: 'Primark', category: 'fashion', country: 'IE', website: 'primark.com' },
  { pageId: '102541029806521', pageName: 'Shein', category: 'fashion', country: 'CN', website: 'shein.com' },
  { pageId: '6108431064', pageName: 'Gucci', category: 'fashion', country: 'IT', website: 'gucci.com' },
  { pageId: '217371831645813', pageName: 'Louis Vuitton', category: 'fashion', country: 'FR', website: 'louisvuitton.com' },
  { pageId: '21785951839', pageName: 'Burberry', category: 'fashion', country: 'GB', website: 'burberry.com' },
  { pageId: '7529606940', pageName: 'Prada', category: 'fashion', country: 'IT', website: 'prada.com' },
  { pageId: '69103777749', pageName: 'Chanel', category: 'fashion', country: 'FR', website: 'chanel.com' },
  { pageId: '120459451318330', pageName: 'Dior', category: 'fashion', country: 'FR', website: 'dior.com' },
  { pageId: '103991826302640', pageName: 'Versace', category: 'fashion', country: 'IT', website: 'versace.com' },
  { pageId: '51068015034', pageName: 'Tommy Hilfiger', category: 'fashion', country: 'US', website: 'tommy.com' },
  { pageId: '39456813561', pageName: 'Calvin Klein', category: 'fashion', country: 'US', website: 'calvinklein.com' },
  { pageId: '57308622233', pageName: 'Ralph Lauren', category: 'fashion', country: 'US', website: 'ralphlauren.com' },
  { pageId: '10069305039', pageName: 'Levi\'s', category: 'fashion', country: 'US', website: 'levi.com' },
  { pageId: '170847146296270', pageName: 'Mango', category: 'fashion', country: 'ES', website: 'mango.com' },
  { pageId: '129271657093501', pageName: 'Pull&Bear', category: 'fashion', country: 'ES', website: 'pullandbear.com' },
  { pageId: '147165825308282', pageName: 'Bershka', category: 'fashion', country: 'ES', website: 'bershka.com' },
  { pageId: '112330708796238', pageName: 'Massimo Dutti', category: 'fashion', country: 'ES', website: 'massimodutti.com' },
  { pageId: '25003749333', pageName: 'Gap', category: 'fashion', country: 'US', website: 'gap.com' },
  { pageId: '22092443056', pageName: 'Forever 21', category: 'fashion', country: 'US', website: 'forever21.com' },
  { pageId: '50837102955', pageName: 'Urban Outfitters', category: 'fashion', country: 'US', website: 'urbanoutfitters.com' },
  { pageId: '42560265417', pageName: 'Free People', category: 'fashion', country: 'US', website: 'freepeople.com' },
  { pageId: '87892560628', pageName: 'Anthropologie', category: 'fashion', country: 'US', website: 'anthropologie.com' },
  { pageId: '158067314260', pageName: 'UNIQLO', category: 'fashion', country: 'JP', website: 'uniqlo.com' },
  { pageId: '30464304917', pageName: 'J.Crew', category: 'fashion', country: 'US', website: 'jcrew.com' },
  { pageId: '41178476773', pageName: 'Banana Republic', category: 'fashion', country: 'US', website: 'bananarepublic.com' },
  { pageId: '183671321673187', pageName: 'COS', category: 'fashion', country: 'SE', website: 'cosstores.com' },
  { pageId: '20353361589', pageName: '& Other Stories', category: 'fashion', country: 'SE', website: 'stories.com' },
  { pageId: '15087023444', pageName: 'Topshop', category: 'fashion', country: 'GB', website: 'topshop.com' },
  { pageId: '42971607328', pageName: 'River Island', category: 'fashion', country: 'GB', website: 'riverisland.com' },
  { pageId: '62076222418', pageName: 'New Look', category: 'fashion', country: 'GB', website: 'newlook.com' },
  { pageId: '43871069100', pageName: 'Boohoo', category: 'fashion', country: 'GB', website: 'boohoo.com' },
  { pageId: '237776246263163', pageName: 'PrettyLittleThing', category: 'fashion', country: 'GB', website: 'prettylittlething.com' },
  { pageId: '109157122436990', pageName: 'Missguided', category: 'fashion', country: 'GB', website: 'missguided.com' },
  { pageId: '21107251173', pageName: 'Net-a-Porter', category: 'fashion', country: 'GB', website: 'net-a-porter.com' },
  { pageId: '88916555952', pageName: 'Farfetch', category: 'fashion', country: 'PT', website: 'farfetch.com' },
  { pageId: '133648980043034', pageName: 'Mytheresa', category: 'fashion', country: 'DE', website: 'mytheresa.com' },
  { pageId: '96585976749', pageName: 'Matches Fashion', category: 'fashion', country: 'GB', website: 'matchesfashion.com' },
  { pageId: '140557019314424', pageName: 'Revolve', category: 'fashion', country: 'US', website: 'revolve.com' },
  { pageId: '7587116584', pageName: 'Nordstrom', category: 'fashion', country: 'US', website: 'nordstrom.com' },
  { pageId: '7651188893', pageName: 'Bloomingdale\'s', category: 'fashion', country: 'US', website: 'bloomingdales.com' },
  { pageId: '5829529294', pageName: 'Macy\'s', category: 'fashion', country: 'US', website: 'macys.com' },
  { pageId: '153125964714466', pageName: 'Zalando', category: 'fashion', country: 'DE', website: 'zalando.com' },
  { pageId: '148752108501632', pageName: 'About You', category: 'fashion', country: 'DE', website: 'aboutyou.com' },
  { pageId: '134074649952813', pageName: 'Puma', category: 'fashion', country: 'DE', website: 'puma.com' },
];

// Beauty brands (50+)
const beautyBrands: BrandSeed[] = [
  { pageId: '110854058942393', pageName: 'Sephora', category: 'beauty', country: 'FR', website: 'sephora.com' },
  { pageId: '127497327289192', pageName: 'Ulta Beauty', category: 'beauty', country: 'US', website: 'ulta.com' },
  { pageId: '156426421068078', pageName: 'MAC Cosmetics', category: 'beauty', country: 'US', website: 'maccosmetics.com' },
  { pageId: '108052329229826', pageName: 'Charlotte Tilbury', category: 'beauty', country: 'GB', website: 'charlottetilbury.com' },
  { pageId: '38716034624', pageName: 'NARS Cosmetics', category: 'beauty', country: 'US', website: 'narscosmetics.com' },
  { pageId: '186970721347380', pageName: 'Fenty Beauty', category: 'beauty', country: 'US', website: 'fentybeauty.com' },
  { pageId: '22509311074', pageName: 'Too Faced', category: 'beauty', country: 'US', website: 'toofaced.com' },
  { pageId: '46736112441', pageName: 'Urban Decay', category: 'beauty', country: 'US', website: 'urbandecay.com' },
  { pageId: '76480457932', pageName: 'Benefit Cosmetics', category: 'beauty', country: 'US', website: 'benefitcosmetics.com' },
  { pageId: '5578152821', pageName: 'Estée Lauder', category: 'beauty', country: 'US', website: 'esteelauder.com' },
  { pageId: '15714739640', pageName: 'Clinique', category: 'beauty', country: 'US', website: 'clinique.com' },
  { pageId: '104074256295977', pageName: 'Lancôme', category: 'beauty', country: 'FR', website: 'lancome.com' },
  { pageId: '112151185482002', pageName: 'YSL Beauty', category: 'beauty', country: 'FR', website: 'yslbeauty.com' },
  { pageId: '167131143312097', pageName: 'Dior Beauty', category: 'beauty', country: 'FR', website: 'dior.com/beauty' },
  { pageId: '195612817152245', pageName: 'Chanel Beauty', category: 'beauty', country: 'FR', website: 'chanel.com/beauty' },
  { pageId: '9720989078', pageName: 'Bobbi Brown', category: 'beauty', country: 'US', website: 'bobbibrown.com' },
  { pageId: '206411479389619', pageName: 'Kylie Cosmetics', category: 'beauty', country: 'US', website: 'kyliecosmetics.com' },
  { pageId: '143679902316810', pageName: 'Rare Beauty', category: 'beauty', country: 'US', website: 'rarebeauty.com' },
  { pageId: '105536766141152', pageName: 'Glossier', category: 'beauty', country: 'US', website: 'glossier.com' },
  { pageId: '7583813455', pageName: 'The Ordinary', category: 'beauty', country: 'CA', website: 'theordinary.com' },
  { pageId: '109310522430048', pageName: 'CeraVe', category: 'beauty', country: 'US', website: 'cerave.com' },
  { pageId: '182986045043660', pageName: 'La Roche-Posay', category: 'beauty', country: 'FR', website: 'laroche-posay.com' },
  { pageId: '21314020974', pageName: 'Kiehl\'s', category: 'beauty', country: 'US', website: 'kiehls.com' },
  { pageId: '56381779046', pageName: 'Origins', category: 'beauty', country: 'US', website: 'origins.com' },
  { pageId: '18609891348', pageName: 'Fresh', category: 'beauty', country: 'US', website: 'fresh.com' },
  { pageId: '7596267977', pageName: 'Olay', category: 'beauty', country: 'US', website: 'olay.com' },
  { pageId: '8196377782', pageName: 'Neutrogena', category: 'beauty', country: 'US', website: 'neutrogena.com' },
  { pageId: '15904992789', pageName: 'L\'Oreal Paris', category: 'beauty', country: 'FR', website: 'loreal-paris.com' },
  { pageId: '41192088316', pageName: 'Maybelline', category: 'beauty', country: 'US', website: 'maybelline.com' },
  { pageId: '15089265188', pageName: 'Revlon', category: 'beauty', country: 'US', website: 'revlon.com' },
  { pageId: '6613076816', pageName: 'NYX Cosmetics', category: 'beauty', country: 'US', website: 'nyxcosmetics.com' },
  { pageId: '40796308305', pageName: 'e.l.f. Cosmetics', category: 'beauty', country: 'US', website: 'elfcosmetics.com' },
  { pageId: '112638352080379', pageName: 'ColourPop', category: 'beauty', country: 'US', website: 'colourpop.com' },
  { pageId: '68267882009', pageName: 'Tarte Cosmetics', category: 'beauty', country: 'US', website: 'tartecosmetics.com' },
  { pageId: '95246893688', pageName: 'IT Cosmetics', category: 'beauty', country: 'US', website: 'itcosmetics.com' },
  { pageId: '226013760748', pageName: 'Drunk Elephant', category: 'beauty', country: 'US', website: 'drunkelephant.com' },
  { pageId: '100608736742048', pageName: 'Tatcha', category: 'beauty', country: 'US', website: 'tatcha.com' },
  { pageId: '109287862437996', pageName: 'Sunday Riley', category: 'beauty', country: 'US', website: 'sundayriley.com' },
  { pageId: '49648028835', pageName: 'Dermalogica', category: 'beauty', country: 'US', website: 'dermalogica.com' },
  { pageId: '14530314282', pageName: 'Murad', category: 'beauty', country: 'US', website: 'murad.com' },
  { pageId: '116289495068001', pageName: 'Paula\'s Choice', category: 'beauty', country: 'US', website: 'paulaschoice.com' },
  { pageId: '21785839437', pageName: 'Aveda', category: 'beauty', country: 'US', website: 'aveda.com' },
  { pageId: '41696785085', pageName: 'Moroccanoil', category: 'beauty', country: 'US', website: 'moroccanoil.com' },
  { pageId: '103735502990287', pageName: 'Olaplex', category: 'beauty', country: 'US', website: 'olaplex.com' },
  { pageId: '7688992107', pageName: 'Kerastase', category: 'beauty', country: 'FR', website: 'kerastase.com' },
  { pageId: '116515158379092', pageName: 'Ouai', category: 'beauty', country: 'US', website: 'theouai.com' },
  { pageId: '32095420968', pageName: 'Bumble and bumble', category: 'beauty', country: 'US', website: 'bumbleandbumble.com' },
  { pageId: '95813527196', pageName: 'Living Proof', category: 'beauty', country: 'US', website: 'livingproof.com' },
  { pageId: '8253579067', pageName: 'Bath & Body Works', category: 'beauty', country: 'US', website: 'bathandbodyworks.com' },
  { pageId: '137899452935254', pageName: 'Sol de Janeiro', category: 'beauty', country: 'US', website: 'soldejaneiro.com' },
];

// Non-profit organizations (50+)
const nonprofitBrands: BrandSeed[] = [
  { pageId: '29388628371', pageName: 'UNICEF', category: 'nonprofit', country: 'US', website: 'unicef.org' },
  { pageId: '7879939555', pageName: 'Red Cross', category: 'nonprofit', country: 'CH', website: 'redcross.org' },
  { pageId: '16285181968', pageName: 'WWF', category: 'nonprofit', country: 'CH', website: 'wwf.org' },
  { pageId: '5644546534', pageName: 'Greenpeace', category: 'nonprofit', country: 'NL', website: 'greenpeace.org' },
  { pageId: '26837197076', pageName: 'Amnesty International', category: 'nonprofit', country: 'GB', website: 'amnesty.org' },
  { pageId: '8066474639', pageName: 'Doctors Without Borders', category: 'nonprofit', country: 'FR', website: 'doctorswithoutborders.org' },
  { pageId: '20884282091', pageName: 'Save the Children', category: 'nonprofit', country: 'GB', website: 'savethechildren.org' },
  { pageId: '8523781298', pageName: 'Oxfam', category: 'nonprofit', country: 'GB', website: 'oxfam.org' },
  { pageId: '8315579749', pageName: 'CARE International', category: 'nonprofit', country: 'CH', website: 'care.org' },
  { pageId: '25838812888', pageName: 'World Vision', category: 'nonprofit', country: 'US', website: 'worldvision.org' },
  { pageId: '84364215199', pageName: 'Habitat for Humanity', category: 'nonprofit', country: 'US', website: 'habitat.org' },
  { pageId: '7963715384', pageName: 'Make-A-Wish', category: 'nonprofit', country: 'US', website: 'wish.org' },
  { pageId: '51972683180', pageName: 'St. Jude Children\'s Research Hospital', category: 'nonprofit', country: 'US', website: 'stjude.org' },
  { pageId: '14123377011', pageName: 'American Cancer Society', category: 'nonprofit', country: 'US', website: 'cancer.org' },
  { pageId: '47588774069', pageName: 'American Heart Association', category: 'nonprofit', country: 'US', website: 'heart.org' },
  { pageId: '47019162893', pageName: 'Susan G. Komen', category: 'nonprofit', country: 'US', website: 'komen.org' },
  { pageId: '121882817846175', pageName: 'Alzheimer\'s Association', category: 'nonprofit', country: 'US', website: 'alz.org' },
  { pageId: '8197378422', pageName: 'ASPCA', category: 'nonprofit', country: 'US', website: 'aspca.org' },
  { pageId: '184802731667866', pageName: 'Humane Society', category: 'nonprofit', country: 'US', website: 'humanesociety.org' },
  { pageId: '66498325679', pageName: 'PETA', category: 'nonprofit', country: 'US', website: 'peta.org' },
  { pageId: '78716159987', pageName: 'The Nature Conservancy', category: 'nonprofit', country: 'US', website: 'nature.org' },
  { pageId: '5889093598', pageName: 'Sierra Club', category: 'nonprofit', country: 'US', website: 'sierraclub.org' },
  { pageId: '17823660839', pageName: 'Environmental Defense Fund', category: 'nonprofit', country: 'US', website: 'edf.org' },
  { pageId: '7475580609', pageName: 'Feeding America', category: 'nonprofit', country: 'US', website: 'feedingamerica.org' },
  { pageId: '8557355643', pageName: 'Meals on Wheels', category: 'nonprofit', country: 'US', website: 'mealsonwheelsamerica.org' },
  { pageId: '32940860867', pageName: 'charity: water', category: 'nonprofit', country: 'US', website: 'charitywater.org' },
  { pageId: '294810620539291', pageName: 'Water.org', category: 'nonprofit', country: 'US', website: 'water.org' },
  { pageId: '6238086749', pageName: 'Heifer International', category: 'nonprofit', country: 'US', website: 'heifer.org' },
  { pageId: '49428379144', pageName: 'Kiva', category: 'nonprofit', country: 'US', website: 'kiva.org' },
  { pageId: '8584291315', pageName: 'Teach For America', category: 'nonprofit', country: 'US', website: 'teachforamerica.org' },
  { pageId: '9167093960', pageName: 'Boys & Girls Clubs', category: 'nonprofit', country: 'US', website: 'bgca.org' },
  { pageId: '9124187907', pageName: 'Big Brothers Big Sisters', category: 'nonprofit', country: 'US', website: 'bbbs.org' },
  { pageId: '86234516556', pageName: 'Girl Scouts', category: 'nonprofit', country: 'US', website: 'girlscouts.org' },
  { pageId: '17437249305', pageName: 'Boy Scouts of America', category: 'nonprofit', country: 'US', website: 'scouting.org' },
  { pageId: '5767902437', pageName: 'Planned Parenthood', category: 'nonprofit', country: 'US', website: 'plannedparenthood.org' },
  { pageId: '29390691021', pageName: 'ACLU', category: 'nonprofit', country: 'US', website: 'aclu.org' },
  { pageId: '109969059028173', pageName: 'Human Rights Campaign', category: 'nonprofit', country: 'US', website: 'hrc.org' },
  { pageId: '51165701056', pageName: 'NAACP', category: 'nonprofit', country: 'US', website: 'naacp.org' },
  { pageId: '6062212553', pageName: 'Special Olympics', category: 'nonprofit', country: 'US', website: 'specialolympics.org' },
  { pageId: '22694070605', pageName: 'Wounded Warrior Project', category: 'nonprofit', country: 'US', website: 'woundedwarriorproject.org' },
  { pageId: '45016163348', pageName: 'Fisher House', category: 'nonprofit', country: 'US', website: 'fisherhouse.org' },
  { pageId: '7831712111', pageName: 'Salvation Army', category: 'nonprofit', country: 'US', website: 'salvationarmy.org' },
  { pageId: '33376273879', pageName: 'Goodwill Industries', category: 'nonprofit', country: 'US', website: 'goodwill.org' },
  { pageId: '57908079193', pageName: 'United Way', category: 'nonprofit', country: 'US', website: 'unitedway.org' },
  { pageId: '19190223523', pageName: 'YMCA', category: 'nonprofit', country: 'US', website: 'ymca.org' },
  { pageId: '7175847133', pageName: 'Direct Relief', category: 'nonprofit', country: 'US', website: 'directrelief.org' },
  { pageId: '16265118393', pageName: 'Global Giving', category: 'nonprofit', country: 'US', website: 'globalgiving.org' },
  { pageId: '120155984672523', pageName: 'Clinton Foundation', category: 'nonprofit', country: 'US', website: 'clintonfoundation.org' },
  { pageId: '6210982423', pageName: 'Gates Foundation', category: 'nonprofit', country: 'US', website: 'gatesfoundation.org' },
  { pageId: '14219054342', pageName: 'Robin Hood', category: 'nonprofit', country: 'US', website: 'robinhood.org' },
];

// Universities (50+)
const universityBrands: BrandSeed[] = [
  { pageId: '20453886166', pageName: 'Harvard University', category: 'university', country: 'US', website: 'harvard.edu' },
  { pageId: '5721397321', pageName: 'MIT', category: 'university', country: 'US', website: 'mit.edu' },
  { pageId: '18058830773', pageName: 'Stanford University', category: 'university', country: 'US', website: 'stanford.edu' },
  { pageId: '15846496516', pageName: 'Yale University', category: 'university', country: 'US', website: 'yale.edu' },
  { pageId: '58451748679', pageName: 'Princeton University', category: 'university', country: 'US', website: 'princeton.edu' },
  { pageId: '75443618453', pageName: 'Columbia University', category: 'university', country: 'US', website: 'columbia.edu' },
  { pageId: '5765609885', pageName: 'University of Pennsylvania', category: 'university', country: 'US', website: 'upenn.edu' },
  { pageId: '113829015309097', pageName: 'University of Chicago', category: 'university', country: 'US', website: 'uchicago.edu' },
  { pageId: '137369879632825', pageName: 'Duke University', category: 'university', country: 'US', website: 'duke.edu' },
  { pageId: '6135262665', pageName: 'Northwestern University', category: 'university', country: 'US', website: 'northwestern.edu' },
  { pageId: '107923265903471', pageName: 'Caltech', category: 'university', country: 'US', website: 'caltech.edu' },
  { pageId: '7422636868', pageName: 'Johns Hopkins University', category: 'university', country: 'US', website: 'jhu.edu' },
  { pageId: '40251037315', pageName: 'Cornell University', category: 'university', country: 'US', website: 'cornell.edu' },
  { pageId: '31821048339', pageName: 'Brown University', category: 'university', country: 'US', website: 'brown.edu' },
  { pageId: '18093094143', pageName: 'Dartmouth College', category: 'university', country: 'US', website: 'dartmouth.edu' },
  { pageId: '29653377105', pageName: 'Vanderbilt University', category: 'university', country: 'US', website: 'vanderbilt.edu' },
  { pageId: '81093873419', pageName: 'Rice University', category: 'university', country: 'US', website: 'rice.edu' },
  { pageId: '67739574028', pageName: 'Notre Dame', category: 'university', country: 'US', website: 'nd.edu' },
  { pageId: '16760022296', pageName: 'UCLA', category: 'university', country: 'US', website: 'ucla.edu' },
  { pageId: '15451344090', pageName: 'UC Berkeley', category: 'university', country: 'US', website: 'berkeley.edu' },
  { pageId: '49086411723', pageName: 'University of Michigan', category: 'university', country: 'US', website: 'umich.edu' },
  { pageId: '5962294556', pageName: 'University of Virginia', category: 'university', country: 'US', website: 'virginia.edu' },
  { pageId: '9212303737', pageName: 'Georgetown University', category: 'university', country: 'US', website: 'georgetown.edu' },
  { pageId: '25827036254', pageName: 'USC', category: 'university', country: 'US', website: 'usc.edu' },
  { pageId: '35085069974', pageName: 'Carnegie Mellon', category: 'university', country: 'US', website: 'cmu.edu' },
  { pageId: '8181261113', pageName: 'NYU', category: 'university', country: 'US', website: 'nyu.edu' },
  { pageId: '16249177468', pageName: 'Boston University', category: 'university', country: 'US', website: 'bu.edu' },
  { pageId: '5812294245', pageName: 'University of Oxford', category: 'university', country: 'GB', website: 'ox.ac.uk' },
  { pageId: '20780050630', pageName: 'University of Cambridge', category: 'university', country: 'GB', website: 'cam.ac.uk' },
  { pageId: '23615649787', pageName: 'Imperial College London', category: 'university', country: 'GB', website: 'imperial.ac.uk' },
  { pageId: '22052099001', pageName: 'UCL', category: 'university', country: 'GB', website: 'ucl.ac.uk' },
  { pageId: '25291012143', pageName: 'LSE', category: 'university', country: 'GB', website: 'lse.ac.uk' },
  { pageId: '62975067240', pageName: 'University of Edinburgh', category: 'university', country: 'GB', website: 'ed.ac.uk' },
  { pageId: '35181751832', pageName: 'King\'s College London', category: 'university', country: 'GB', website: 'kcl.ac.uk' },
  { pageId: '27740292139', pageName: 'University of Manchester', category: 'university', country: 'GB', website: 'manchester.ac.uk' },
  { pageId: '107899682565768', pageName: 'ETH Zurich', category: 'university', country: 'CH', website: 'ethz.ch' },
  { pageId: '21175587696', pageName: 'TU Munich', category: 'university', country: 'DE', website: 'tum.de' },
  { pageId: '75069810201', pageName: 'LMU Munich', category: 'university', country: 'DE', website: 'lmu.de' },
  { pageId: '47116084063', pageName: 'Heidelberg University', category: 'university', country: 'DE', website: 'uni-heidelberg.de' },
  { pageId: '73227313455', pageName: 'Sorbonne University', category: 'university', country: 'FR', website: 'sorbonne-universite.fr' },
  { pageId: '107988602549115', pageName: 'Sciences Po', category: 'university', country: 'FR', website: 'sciencespo.fr' },
  { pageId: '135499596474330', pageName: 'HEC Paris', category: 'university', country: 'FR', website: 'hec.edu' },
  { pageId: '114850471873588', pageName: 'INSEAD', category: 'university', country: 'FR', website: 'insead.edu' },
  { pageId: '104026489628680', pageName: 'University of Toronto', category: 'university', country: 'CA', website: 'utoronto.ca' },
  { pageId: '34568893768', pageName: 'McGill University', category: 'university', country: 'CA', website: 'mcgill.ca' },
  { pageId: '108105009217830', pageName: 'UBC', category: 'university', country: 'CA', website: 'ubc.ca' },
  { pageId: '151545491543934', pageName: 'University of Melbourne', category: 'university', country: 'AU', website: 'unimelb.edu.au' },
  { pageId: '22096395163', pageName: 'University of Sydney', category: 'university', country: 'AU', website: 'sydney.edu.au' },
  { pageId: '161814650504666', pageName: 'NUS Singapore', category: 'university', country: 'SG', website: 'nus.edu.sg' },
  { pageId: '15667710498', pageName: 'University of Tokyo', category: 'university', country: 'JP', website: 'u-tokyo.ac.jp' },
];

// Tech brands (50+)
const techBrands: BrandSeed[] = [
  { pageId: '20531316728', pageName: 'Apple', category: 'tech', country: 'US', website: 'apple.com' },
  { pageId: '2042264229', pageName: 'Google', category: 'tech', country: 'US', website: 'google.com' },
  { pageId: '6540225376', pageName: 'Microsoft', category: 'tech', country: 'US', website: 'microsoft.com' },
  { pageId: '168165256534089', pageName: 'Amazon', category: 'tech', country: 'US', website: 'amazon.com' },
  { pageId: '20165623885', pageName: 'Facebook (Meta)', category: 'tech', country: 'US', website: 'meta.com' },
  { pageId: '87741124305', pageName: 'Netflix', category: 'tech', country: 'US', website: 'netflix.com' },
  { pageId: '100289240012024', pageName: 'Spotify', category: 'tech', country: 'SE', website: 'spotify.com' },
  { pageId: '150063545081134', pageName: 'Tesla', category: 'tech', country: 'US', website: 'tesla.com' },
  { pageId: '7860046429', pageName: 'Samsung', category: 'tech', country: 'KR', website: 'samsung.com' },
  { pageId: '6097655757', pageName: 'Intel', category: 'tech', country: 'US', website: 'intel.com' },
  { pageId: '110620779074389', pageName: 'NVIDIA', category: 'tech', country: 'US', website: 'nvidia.com' },
  { pageId: '7553478854', pageName: 'IBM', category: 'tech', country: 'US', website: 'ibm.com' },
  { pageId: '64197492619', pageName: 'Oracle', category: 'tech', country: 'US', website: 'oracle.com' },
  { pageId: '7538189697', pageName: 'Cisco', category: 'tech', country: 'US', website: 'cisco.com' },
  { pageId: '251818808185689', pageName: 'Salesforce', category: 'tech', country: 'US', website: 'salesforce.com' },
  { pageId: '8445661441', pageName: 'Adobe', category: 'tech', country: 'US', website: 'adobe.com' },
  { pageId: '24025710250', pageName: 'LinkedIn', category: 'tech', country: 'US', website: 'linkedin.com' },
  { pageId: '37815818192', pageName: 'Twitter (X)', category: 'tech', country: 'US', website: 'x.com' },
  { pageId: '113869198637354', pageName: 'TikTok', category: 'tech', country: 'CN', website: 'tiktok.com' },
  { pageId: '67859910015', pageName: 'Snapchat', category: 'tech', country: 'US', website: 'snapchat.com' },
  { pageId: '7862166108', pageName: 'Pinterest', category: 'tech', country: 'US', website: 'pinterest.com' },
  { pageId: '108095449222746', pageName: 'Reddit', category: 'tech', country: 'US', website: 'reddit.com' },
  { pageId: '139578129410266', pageName: 'Discord', category: 'tech', country: 'US', website: 'discord.com' },
  { pageId: '134259226637398', pageName: 'Zoom', category: 'tech', country: 'US', website: 'zoom.us' },
  { pageId: '7634525440', pageName: 'Slack', category: 'tech', country: 'US', website: 'slack.com' },
  { pageId: '260276587335934', pageName: 'Notion', category: 'tech', country: 'US', website: 'notion.so' },
  { pageId: '131032026975251', pageName: 'Figma', category: 'tech', country: 'US', website: 'figma.com' },
  { pageId: '10541965226', pageName: 'Dropbox', category: 'tech', country: 'US', website: 'dropbox.com' },
  { pageId: '95299126339', pageName: 'Shopify', category: 'tech', country: 'CA', website: 'shopify.com' },
  { pageId: '103174103078988', pageName: 'Stripe', category: 'tech', country: 'US', website: 'stripe.com' },
  { pageId: '7585066889', pageName: 'PayPal', category: 'tech', country: 'US', website: 'paypal.com' },
  { pageId: '131652866867843', pageName: 'Square', category: 'tech', country: 'US', website: 'squareup.com' },
  { pageId: '8462600463', pageName: 'Uber', category: 'tech', country: 'US', website: 'uber.com' },
  { pageId: '156539037699146', pageName: 'Lyft', category: 'tech', country: 'US', website: 'lyft.com' },
  { pageId: '119890224718879', pageName: 'Airbnb', category: 'tech', country: 'US', website: 'airbnb.com' },
  { pageId: '139831846044190', pageName: 'DoorDash', category: 'tech', country: 'US', website: 'doordash.com' },
  { pageId: '163829893664459', pageName: 'Instacart', category: 'tech', country: 'US', website: 'instacart.com' },
  { pageId: '113152512054286', pageName: 'Robinhood', category: 'tech', country: 'US', website: 'robinhood.com' },
  { pageId: '262994617071645', pageName: 'Coinbase', category: 'tech', country: 'US', website: 'coinbase.com' },
  { pageId: '109013025791413', pageName: 'Palantir', category: 'tech', country: 'US', website: 'palantir.com' },
  { pageId: '181076378585314', pageName: 'Snowflake', category: 'tech', country: 'US', website: 'snowflake.com' },
  { pageId: '190844684295988', pageName: 'Databricks', category: 'tech', country: 'US', website: 'databricks.com' },
  { pageId: '6761108401', pageName: 'SAP', category: 'tech', country: 'DE', website: 'sap.com' },
  { pageId: '8697049478', pageName: 'Atlassian', category: 'tech', country: 'AU', website: 'atlassian.com' },
  { pageId: '7659225380', pageName: 'HP', category: 'tech', country: 'US', website: 'hp.com' },
  { pageId: '8285296688', pageName: 'Dell', category: 'tech', country: 'US', website: 'dell.com' },
  { pageId: '8098916619', pageName: 'Lenovo', category: 'tech', country: 'CN', website: 'lenovo.com' },
  { pageId: '7585618219', pageName: 'Sony', category: 'tech', country: 'JP', website: 'sony.com' },
  { pageId: '6746342369', pageName: 'LG', category: 'tech', country: 'KR', website: 'lg.com' },
  { pageId: '108080482553567', pageName: 'Huawei', category: 'tech', country: 'CN', website: 'huawei.com' },
];

// Food & Beverage (50+)
const foodBrands: BrandSeed[] = [
  { pageId: '5550296508', pageName: 'Coca-Cola', category: 'food', country: 'US', website: 'coca-cola.com' },
  { pageId: '56381779799', pageName: 'Pepsi', category: 'food', country: 'US', website: 'pepsi.com' },
  { pageId: '8205181058', pageName: 'McDonald\'s', category: 'food', country: 'US', website: 'mcdonalds.com' },
  { pageId: '7726159462', pageName: 'Starbucks', category: 'food', country: 'US', website: 'starbucks.com' },
  { pageId: '7384363254', pageName: 'Burger King', category: 'food', country: 'US', website: 'bk.com' },
  { pageId: '6885047195', pageName: 'KFC', category: 'food', country: 'US', website: 'kfc.com' },
  { pageId: '78246933858', pageName: 'Pizza Hut', category: 'food', country: 'US', website: 'pizzahut.com' },
  { pageId: '120922144585620', pageName: 'Domino\'s', category: 'food', country: 'US', website: 'dominos.com' },
  { pageId: '17308133124', pageName: 'Subway', category: 'food', country: 'US', website: 'subway.com' },
  { pageId: '30534038710', pageName: 'Taco Bell', category: 'food', country: 'US', website: 'tacobell.com' },
  { pageId: '25455251096', pageName: 'Chipotle', category: 'food', country: 'US', website: 'chipotle.com' },
  { pageId: '6696316975', pageName: 'Wendy\'s', category: 'food', country: 'US', website: 'wendys.com' },
  { pageId: '91606934418', pageName: 'Five Guys', category: 'food', country: 'US', website: 'fiveguys.com' },
  { pageId: '104893762898247', pageName: 'Shake Shack', category: 'food', country: 'US', website: 'shakeshack.com' },
  { pageId: '8758116117', pageName: 'Dunkin\'', category: 'food', country: 'US', website: 'dunkindonuts.com' },
  { pageId: '109268235771091', pageName: 'Krispy Kreme', category: 'food', country: 'US', website: 'krispykreme.com' },
  { pageId: '6413127107', pageName: 'Baskin-Robbins', category: 'food', country: 'US', website: 'baskinrobbins.com' },
  { pageId: '6051869847', pageName: 'Ben & Jerry\'s', category: 'food', country: 'US', website: 'benjerry.com' },
  { pageId: '8262826623', pageName: 'Haagen-Dazs', category: 'food', country: 'US', website: 'haagendazs.com' },
  { pageId: '5797893652', pageName: 'Nestlé', category: 'food', country: 'CH', website: 'nestle.com' },
  { pageId: '6210756591', pageName: 'Kraft Heinz', category: 'food', country: 'US', website: 'kraftheinzcompany.com' },
  { pageId: '6128676851', pageName: 'Kellogg\'s', category: 'food', country: 'US', website: 'kelloggs.com' },
  { pageId: '6245177903', pageName: 'General Mills', category: 'food', country: 'US', website: 'generalmills.com' },
  { pageId: '6046290097', pageName: 'Mondelez', category: 'food', country: 'US', website: 'mondelezinternational.com' },
  { pageId: '6223481133', pageName: 'Mars', category: 'food', country: 'US', website: 'mars.com' },
  { pageId: '8025696163', pageName: 'Hershey\'s', category: 'food', country: 'US', website: 'hersheys.com' },
  { pageId: '5896946116', pageName: 'Ferrero', category: 'food', country: 'IT', website: 'ferrero.com' },
  { pageId: '8251655167', pageName: 'Lindt', category: 'food', country: 'CH', website: 'lindt.com' },
  { pageId: '9050756348', pageName: 'Godiva', category: 'food', country: 'BE', website: 'godiva.com' },
  { pageId: '8502626626', pageName: 'Red Bull', category: 'food', country: 'AT', website: 'redbull.com' },
  { pageId: '17859939887', pageName: 'Monster Energy', category: 'food', country: 'US', website: 'monsterenergy.com' },
  { pageId: '6124802851', pageName: 'Gatorade', category: 'food', country: 'US', website: 'gatorade.com' },
  { pageId: '21262398622', pageName: 'Budweiser', category: 'food', country: 'US', website: 'budweiser.com' },
  { pageId: '76591012949', pageName: 'Heineken', category: 'food', country: 'NL', website: 'heineken.com' },
  { pageId: '26610829162', pageName: 'Guinness', category: 'food', country: 'IE', website: 'guinness.com' },
  { pageId: '44055531011', pageName: 'Corona', category: 'food', country: 'MX', website: 'coronausa.com' },
  { pageId: '121448454552756', pageName: 'Absolut', category: 'food', country: 'SE', website: 'absolut.com' },
  { pageId: '20246653538', pageName: 'Jack Daniel\'s', category: 'food', country: 'US', website: 'jackdaniels.com' },
  { pageId: '135847289783055', pageName: 'Johnnie Walker', category: 'food', country: 'GB', website: 'johnniewalker.com' },
  { pageId: '6141234568', pageName: 'Grey Goose', category: 'food', country: 'FR', website: 'greygoose.com' },
  { pageId: '61192656656', pageName: 'Whole Foods', category: 'food', country: 'US', website: 'wholefoodsmarket.com' },
  { pageId: '54395028178', pageName: 'Trader Joe\'s', category: 'food', country: 'US', website: 'traderjoes.com' },
  { pageId: '7853388237', pageName: 'Costco', category: 'food', country: 'US', website: 'costco.com' },
  { pageId: '112319955445413', pageName: 'Aldi', category: 'food', country: 'DE', website: 'aldi.com' },
  { pageId: '6137178089', pageName: 'Lidl', category: 'food', country: 'DE', website: 'lidl.com' },
  { pageId: '5877303188', pageName: 'Tesco', category: 'food', country: 'GB', website: 'tesco.com' },
  { pageId: '8095971989', pageName: 'Sainsbury\'s', category: 'food', country: 'GB', website: 'sainsburys.co.uk' },
  { pageId: '107691505925949', pageName: 'HelloFresh', category: 'food', country: 'DE', website: 'hellofresh.com' },
  { pageId: '305749459504168', pageName: 'Blue Apron', category: 'food', country: 'US', website: 'blueapron.com' },
  { pageId: '136428049720504', pageName: 'Impossible Foods', category: 'food', country: 'US', website: 'impossiblefoods.com' },
];

// Fitness & Sports (50+)
const fitnessBrands: BrandSeed[] = [
  { pageId: '19440138720', pageName: 'Peloton', category: 'fitness', country: 'US', website: 'onepeloton.com' },
  { pageId: '70155730534', pageName: 'Planet Fitness', category: 'fitness', country: 'US', website: 'planetfitness.com' },
  { pageId: '143689259030746', pageName: 'Equinox', category: 'fitness', country: 'US', website: 'equinox.com' },
  { pageId: '26696505209', pageName: 'SoulCycle', category: 'fitness', country: 'US', website: 'soul-cycle.com' },
  { pageId: '156970774313988', pageName: 'ClassPass', category: 'fitness', country: 'US', website: 'classpass.com' },
  { pageId: '8298380633', pageName: 'Fitbit', category: 'fitness', country: 'US', website: 'fitbit.com' },
  { pageId: '122819691091234', pageName: 'Whoop', category: 'fitness', country: 'US', website: 'whoop.com' },
  { pageId: '150203015055010', pageName: 'Oura Ring', category: 'fitness', country: 'FI', website: 'ouraring.com' },
  { pageId: '176064999092022', pageName: 'Garmin', category: 'fitness', country: 'US', website: 'garmin.com' },
  { pageId: '69174163149', pageName: 'Under Armour', category: 'fitness', country: 'US', website: 'underarmour.com' },
  { pageId: '16651583396', pageName: 'Reebok', category: 'fitness', country: 'US', website: 'reebok.com' },
  { pageId: '8116867889', pageName: 'New Balance', category: 'fitness', country: 'US', website: 'newbalance.com' },
  { pageId: '86177254366', pageName: 'ASICS', category: 'fitness', country: 'JP', website: 'asics.com' },
  { pageId: '29191650832', pageName: 'Brooks Running', category: 'fitness', country: 'US', website: 'brooksrunning.com' },
  { pageId: '62595877596', pageName: 'Hoka', category: 'fitness', country: 'US', website: 'hoka.com' },
  { pageId: '9266890165', pageName: 'Saucony', category: 'fitness', country: 'US', website: 'saucony.com' },
  { pageId: '21415178424', pageName: 'Lululemon', category: 'fitness', country: 'CA', website: 'lululemon.com' },
  { pageId: '77068970530', pageName: 'Athleta', category: 'fitness', country: 'US', website: 'athleta.com' },
  { pageId: '106821049336890', pageName: 'Gymshark', category: 'fitness', country: 'GB', website: 'gymshark.com' },
  { pageId: '174161832593635', pageName: 'Fabletics', category: 'fitness', country: 'US', website: 'fabletics.com' },
  { pageId: '134879739870836', pageName: 'Outdoor Voices', category: 'fitness', country: 'US', website: 'outdoorvoices.com' },
  { pageId: '134074649952813', pageName: 'Puma', category: 'fitness', country: 'DE', website: 'puma.com' },
  { pageId: '92930587531', pageName: 'The North Face', category: 'fitness', country: 'US', website: 'thenorthface.com' },
  { pageId: '18618726247', pageName: 'Patagonia', category: 'fitness', country: 'US', website: 'patagonia.com' },
  { pageId: '33894786493', pageName: 'Columbia Sportswear', category: 'fitness', country: 'US', website: 'columbia.com' },
  { pageId: '155587907786858', pageName: 'Arc\'teryx', category: 'fitness', country: 'CA', website: 'arcteryx.com' },
  { pageId: '52379316328', pageName: 'REI', category: 'fitness', country: 'US', website: 'rei.com' },
  { pageId: '7637987001', pageName: 'Osprey', category: 'fitness', country: 'US', website: 'osprey.com' },
  { pageId: '12695821252', pageName: 'GoFundMe', category: 'fitness', country: 'US', website: 'gofundme.com' },
  { pageId: '125605244109225', pageName: 'Strava', category: 'fitness', country: 'US', website: 'strava.com' },
  { pageId: '152553444755924', pageName: 'MyFitnessPal', category: 'fitness', country: 'US', website: 'myfitnesspal.com' },
  { pageId: '167848643228', pageName: 'Headspace', category: 'fitness', country: 'US', website: 'headspace.com' },
  { pageId: '174872572584020', pageName: 'Calm', category: 'fitness', country: 'US', website: 'calm.com' },
  { pageId: '142371752462858', pageName: 'Noom', category: 'fitness', country: 'US', website: 'noom.com' },
  { pageId: '103813879647543', pageName: 'WW (Weight Watchers)', category: 'fitness', country: 'US', website: 'weightwatchers.com' },
  { pageId: '139673116062840', pageName: 'Beachbody', category: 'fitness', country: 'US', website: 'beachbody.com' },
  { pageId: '34024051336', pageName: 'CrossFit', category: 'fitness', country: 'US', website: 'crossfit.com' },
  { pageId: '78456612314', pageName: 'UFC', category: 'fitness', country: 'US', website: 'ufc.com' },
  { pageId: '8251671458', pageName: 'ESPN', category: 'fitness', country: 'US', website: 'espn.com' },
  { pageId: '115174101836191', pageName: 'NBA', category: 'fitness', country: 'US', website: 'nba.com' },
  { pageId: '68680217757', pageName: 'NFL', category: 'fitness', country: 'US', website: 'nfl.com' },
  { pageId: '16460012086', pageName: 'Premier League', category: 'fitness', country: 'GB', website: 'premierleague.com' },
  { pageId: '165476650144049', pageName: 'UEFA Champions League', category: 'fitness', country: 'CH', website: 'uefa.com' },
  { pageId: '109683349058648', pageName: 'Formula 1', category: 'fitness', country: 'GB', website: 'formula1.com' },
  { pageId: '22892624016', pageName: 'WWE', category: 'fitness', country: 'US', website: 'wwe.com' },
  { pageId: '6034944353', pageName: 'GoPro', category: 'fitness', country: 'US', website: 'gopro.com' },
  { pageId: '135096529829361', pageName: 'Yeti', category: 'fitness', country: 'US', website: 'yeti.com' },
  { pageId: '79527329519', pageName: 'Hydro Flask', category: 'fitness', country: 'US', website: 'hydroflask.com' },
  { pageId: '173683292650952', pageName: 'Allbirds', category: 'fitness', country: 'US', website: 'allbirds.com' },
  { pageId: '234848683283953', pageName: 'On Running', category: 'fitness', country: 'CH', website: 'on-running.com' },
];

async function seedBrands() {
  const allBrands = [
    ...fashionBrands,
    ...beautyBrands,
    ...nonprofitBrands,
    ...universityBrands,
    ...techBrands,
    ...foodBrands,
    ...fitnessBrands,
  ];

  console.log(`Seeding ${allBrands.length} brands...`);

  let created = 0;
  let skipped = 0;

  for (const brand of allBrands) {
    try {
      // Check if brand already exists
      const existing = await prisma.adLibraryBrand.findUnique({
        where: { pageId: brand.pageId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.adLibraryBrand.create({
        data: {
          pageId: brand.pageId,
          pageName: brand.pageName,
          category: brand.category,
          country: brand.country,
          website: brand.website,
          ingestionStatus: 'pending',
          priority: brand.category === 'fashion' || brand.category === 'beauty' ? 2 : 1,
        },
      });
      created++;
    } catch (error) {
      console.error(`Failed to create ${brand.pageName}:`, error);
    }
  }

  console.log(`\nSeed complete!`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exist): ${skipped}`);

  // Show breakdown by category
  const breakdown = await prisma.adLibraryBrand.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });

  console.log('\nBrands by category:');
  for (const item of breakdown) {
    console.log(`  ${item.category}: ${item._count}`);
  }
}

seedBrands()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
