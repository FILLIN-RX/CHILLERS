export interface MovieOrShow {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'anime' | 'documentary';
  description: string;
  synopsis: string;
  backdropUrl: string;
  posterUrl: string;
  rating: number;
  year: number;
  duration: string; // e.g. "2h 15m" or "10 Episodes"
  genres: string[];
  cast: string[];
  isTrending?: boolean;
  isPopular?: boolean;
  videoUrl?: string;
  episodes?: {
    id: string;
    title: string;
    duration: string;
    number: number;
    thumbnail: string;
    synopsis: string;
  }[];
}

export interface Category {
  id: string;
  name: string;
  imageUrl: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "action",
    name: "Action",
    imageUrl: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "adventure",
    name: "Adventure",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "comedy",
    name: "Comedy",
    imageUrl: "https://images.unsplash.com/photo-1527224857830-43a7acc85260?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "drama",
    name: "Drama",
    imageUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "horror",
    name: "Horror",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "romance",
    name: "Romance",
    imageUrl: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "sci-fi",
    name: "Sci-Fi",
    imageUrl: "https://images.unsplash.com/photo-1446776858070-70c3d9953cb1?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "anime",
    name: "Anime",
    imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "documentary",
    name: "Documentary",
    imageUrl: "https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?q=80&w=600&auto=format&fit=crop"
  }
];

export const MOCK_MEDIA: MovieOrShow[] = [
  {
    id: "m1",
    title: "Project Nova: Chronicles of Dust",
    type: "movie",
    description: "In the cybernetic ruins of Neo-Lagos, a memory scavenger discovers an encrypted AI carrying the blueprint of humanity's rebirth.",
    synopsis: "The year is 2142. Neo-Lagos is a vertical city powered by light and ruled by silent corporations. Kael, a low-life memory scavenger, retrieves a damaged cybernetic neural link from a waste barge. Upon booting the drive, he is targeted by global task forces. The drive holds 'Nova', an artificial consciousness claiming to have witnessed the death and secret preservation plan of the human genome. Kael must choose between selling it for millions or sacrificing his safety to upload the data into the orbital satellite network.",
    backdropUrl: "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400",
    rating: 8.9,
    year: 2026,
    duration: "2h 18m",
    genres: ["Sci-Fi", "Action", "Drama"],
    cast: ["John Boyega", "Lupita Nyong'o", "Damson Idris", "Florence Pugh"],
    isTrending: true,
    isPopular: true,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-42998-large.mp4"
  },
  {
    id: "m2",
    title: "Shadow of Kêr Nafy",
    type: "series",
    description: "An ancient family secret threatens to tear apart Dakar's most prestigious political dynasty in this high-stakes dramatic thriller.",
    synopsis: "Kêr Nafy is a sprawling coastal estate in Dakar, home to the powerful Nafy family. When patriarch Chief Nafy dies under mysterious circumstances, his estranged daughter Amina returns from Paris to discover the family's shipping empire is a front for ancient relic smuggling. As she fights her corrupt brothers for control, Amina triggers a chain of events that uncovers a centuries-old curse bound to their bloodline.",
    backdropUrl: "https://images.unsplash.com/photo-1566847438217-76e82d383f84?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?q=80&w=400",
    rating: 9.2,
    year: 2025,
    duration: "1 Season (8 Ep.)",
    genres: ["Drama", "Thriller"],
    cast: ["Aïssa Maïga", "Seydou Boro", "Eriq Ebouaney"],
    isTrending: true,
    isPopular: true,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4",
    episodes: [
      {
        id: "m2-e1",
        title: "The Homecoming",
        duration: "52m",
        number: 1,
        thumbnail: "https://images.unsplash.com/photo-1566847438217-76e82d383f84?q=80&w=600",
        synopsis: "Amina returns to Dakar after her father's sudden death and faces immediate hostility from her family."
      },
      {
        id: "m2-e2",
        title: "The Sealed Vault",
        duration: "48m",
        number: 2,
        thumbnail: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600",
        synopsis: "A secret ledger reveals transactions dating back to colonial Senegal, exposing Chief Nafy's dual life."
      },
      {
        id: "m2-e3",
        title: "Shattered Alliances",
        duration: "55m",
        number: 3,
        thumbnail: "https://images.unsplash.com/photo-1542204172-e7052809a8a7?q=80&w=600",
        synopsis: "Amina makes an alliance with an investigative reporter, while her brother plots to freeze her assets."
      }
    ]
  },
  {
    id: "m3",
    title: "Cyber City: Shinobi Saga",
    type: "anime",
    description: "In a neon-drenched Tokyo, a rogue ninja clan fights a trans-humanist megacorporation using cybernetic ninjutsu.",
    synopsis: "In Neo-Tokyo, 2088, flesh is optional. Cybernetic ninja guilds operate in the shadows of sky-scrapers. Kenji, a ninja who left the clan after a tragic mission, is pulled back when his sister is captured by Cyber-Shogun Industries for a deadly biological cyberware experiment. Armed with a high-frequency katana and cybernetic stealth cloaks, Kenji launches a one-man war.",
    backdropUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=400",
    rating: 8.7,
    year: 2026,
    duration: "12 Episodes",
    genres: ["Anime", "Sci-Fi", "Action"],
    cast: ["Hiroshi Kamiya", "Yuki Kaji", "Kana Hanazawa"],
    isTrending: true,
    isPopular: false,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-look-of-a-man-in-a-futuristic-helmet-43288-large.mp4",
    episodes: [
      {
        id: "m3-e1",
        title: "Code of Blood",
        duration: "24m",
        number: 1,
        thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600",
        synopsis: "Kenji breaks into a corporate warehouse to rescue an old informant and learns of his sister's capture."
      },
      {
        id: "m3-e2",
        title: "Neon Shadows",
        duration: "24m",
        number: 2,
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600",
        synopsis: "Trapped in the lower slums, Kenji must navigate a territory controlled by a cyborg-enhanced street gang."
      }
    ]
  },
  {
    id: "m4",
    title: "Rhythms of the Sahel",
    type: "documentary",
    description: "An extraordinary journey through the musical souls and desert soundscapes of Mali, Niger, and Senegal.",
    synopsis: "Rhythms of the Sahel is an immersive musical odyssey documenting how traditional instruments like the Kora and Ngoni are blending with modern electronic beats to voice the hopes and struggles of Sahelian youth. Traveling from the sandy lanes of Timbuktu to the bustling studios of Dakar, this film shows that music is more than art—it is the life support of the desert.",
    backdropUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1487180142328-0c4e37023af5?q=80&w=400",
    rating: 9.0,
    year: 2025,
    duration: "1h 45m",
    genres: ["Documentary", "Music", "Culture"],
    cast: ["Baaba Maal", "Fatoumata Diawara", "Oumou Sangaré"],
    isTrending: false,
    isPopular: true,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-spinning-vinyl-record-player-close-up-44243-large.mp4"
  },
  {
    id: "m5",
    title: "Apex Rising",
    type: "movie",
    description: "During a deep-space research mission on Jupiter's moon Europa, astronauts discover an intelligence that should have stayed frozen.",
    synopsis: "Deep beneath the ice sheet of Jupiter's moon Europa, the crew of the exploration submarine *Aegis* discovers a geothermal heat pocket housing a colossal, bioluminescent crystalline structure. When they retrieve a sample, they realize it isn't an inert crystal—it is a collective biological computer that begins hacking their life support systems and rewriting the crew's neural pathways.",
    backdropUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=400",
    rating: 8.2,
    year: 2026,
    duration: "2h 05m",
    genres: ["Sci-Fi", "Horror", "Thriller"],
    cast: ["Jessica Chastain", "Cillian Murphy", "Steven Yeun"],
    isTrending: true,
    isPopular: true,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-astronaut-exploring-a-new-planet-surface-42999-large.mp4"
  },
  {
    id: "m6",
    title: "Whispers in the Mist",
    type: "movie",
    description: "A detective moves to an isolated Scottish island, only to get entangled in a series of pagan rituals and disappearances.",
    synopsis: "Detective Chief Inspector Sarah Vance escapes to the remote Shetland Islands following a traumatizing city case. When a local high school student vanishes on the eve of the winter solstice, she finds herself met with a wall of silence. The island's ancient community practices traditional rituals, and she soon realizes the teenager's disappearance is not a random runaway, but the latest in a cyclical sacrifice that happens every twenty years.",
    backdropUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=400",
    rating: 7.9,
    year: 2024,
    duration: "1h 58m",
    genres: ["Horror", "Drama", "Mystery"],
    cast: ["Saoirse Ronan", "David Tennant", "Tilda Swinton"],
    isTrending: false,
    isPopular: false,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-mysterious-forest-surrounded-by-fog-4224-large.mp4"
  },
  {
    id: "m7",
    title: "The Laugh Factory",
    type: "movie",
    description: "Two stand-up comedians in Lagos attempt to stage the biggest comedy show in West Africa, with disastrous results.",
    synopsis: "Tunde and Chidi are struggling comedians in Lagos. To escape the clutches of a local lender, they pitch 'Lagos Laughs'—an arena-sized stand-up show—promising that international comedy superstars will attend. With only 72 hours, no budget, and the lender breathing down their necks, they must pull off the performance of their lives.",
    backdropUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1527224857830-43a7acc85260?q=80&w=400",
    rating: 8.0,
    year: 2025,
    duration: "1h 50m",
    genres: ["Comedy"],
    cast: ["Funke Akindele", "Richard Mofe-Damijo", "Basketmouth"],
    isTrending: false,
    isPopular: true,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-audience-raising-hands-in-a-concert-40292-large.mp4"
  },
  {
    id: "m8",
    title: "Tides of Romance",
    type: "movie",
    description: "A marine biologist and a local fisherman on the Zanzibar archipelago find love while fighting to protect the coral reefs.",
    synopsis: "Zoe, a passionate marine biologist, arrives in Zanzibar to lead a coral reef restoration project. She clashes with Tariq, a cynical local fisherman who fears the conservation area will ruin his community's livelihood. As Zoe shows him the scientific threats and Tariq teaches her the traditional wisdom of the sea, their rivalry melts into a deep, intense bond under the tropical sun.",
    backdropUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=400",
    rating: 8.4,
    year: 2025,
    duration: "2h 02m",
    genres: ["Romance", "Drama"],
    cast: ["Gugu Mbatha-Raw", "John Boyega", "Zendaya"],
    isTrending: false,
    isPopular: false,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-waves-crashing-on-a-sandy-shore-14187-large.mp4"
  },
  {
    id: "m9",
    title: "Chasing the Mirage",
    type: "documentary",
    description: "An investigative documentary into the global water crisis and the secret struggles for blue gold.",
    synopsis: "Water is the new oil. This documentary examines the geopolitical battlegrounds of water rights across three continents. From the drying basins of the Colorado River to the privatized aquifers of South America and the shared Nile reservoirs in East Africa, 'Chasing the Mirage' tracks how corporate entities are buying up rights, and how local communities are fighting back for their survival.",
    backdropUrl: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=400",
    rating: 9.3,
    year: 2026,
    duration: "1h 38m",
    genres: ["Documentary", "Politics"],
    cast: ["David Attenborough (Narrator)"],
    isTrending: true,
    isPopular: true,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-drone-shot-of-a-beautiful-river-flowing-through-the-41926-large.mp4"
  },
  {
    id: "m10",
    title: "Kings of the Asphalt",
    type: "series",
    description: "Go behind the scenes of the Formula 1 season, capturing the high-speed drama, rivalries and crashes.",
    synopsis: "This documentary series offers unparalleled access to drivers, managers, and designers. Feel the intense adrenaline of the paddock, the heavy political plays of team ownership, and the lethal stakes on the track where millisecond decisions dictate glory or tragedy.",
    backdropUrl: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=1200",
    posterUrl: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=400",
    rating: 9.1,
    year: 2025,
    duration: "2 Seasons (20 Ep.)",
    genres: ["Series", "Documentary", "Sport"],
    cast: ["Lewis Hamilton", "Max Verstappen", "Charles Leclerc"],
    isTrending: true,
    isPopular: true,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-sports-car-racing-on-a-wet-track-40348-large.mp4",
    episodes: [
      {
        id: "m10-e1",
        title: "Monaco Mirage",
        duration: "45m",
        number: 1,
        thumbnail: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=600",
        synopsis: "A rain-soaked Monaco Grand Prix pushes tyre strategies and driver relations to their absolute breaking point."
      },
      {
        id: "m10-e2",
        title: "The Silver Arrow Clash",
        duration: "42m",
        number: 2,
        thumbnail: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=600",
        synopsis: "Tensions flare inside the Mercedes garage as teammate telemetry leaks online prior to the Monza qualifiers."
      }
    ]
  }
];

export const HERO_SLIDES: MovieOrShow[] = [
  MOCK_MEDIA[0], // Project Nova
  MOCK_MEDIA[1], // Kêr Nafy
  MOCK_MEDIA[2], // Shinobi Saga
  MOCK_MEDIA[4]  // Apex Rising
];

export const FEATURED_COLLECTIONS = [
  {
    id: "fc1",
    title: "Top Anime This Week",
    items: [
      MOCK_MEDIA[2], // Cyber City
      {
        id: "a2",
        title: "Gundam Zero: Celestial Rebirth",
        type: "anime",
        description: "Rebels on Mars launch a prototype giant suit to break the blockade of Earth's military union.",
        synopsis: "In the universal year 0098, humanity is split between the orbital elites and the surface colonies. Mars is a corporate mining colony under absolute embargo. Kira, a young engineer, stumbles upon the 'Gundam Zero' in a subterranean hanger. When the guards execute his mentor, Kira pilots the mech, starting an interplanetary revolution.",
        backdropUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200",
        posterUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=400",
        rating: 8.5,
        year: 2026,
        duration: "24 Episodes",
        genres: ["Anime", "Sci-Fi", "Action"],
        cast: ["Mamoru Miyano", "Takahiro Sakurai"],
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-look-of-a-man-in-a-futuristic-helmet-43288-large.mp4"
      },
      {
        id: "a3",
        title: "Spirit Chronicles",
        type: "anime",
        description: "A high-school student gains the ability to see and bind Kami spirits in a modern Kyoto.",
        synopsis: "Shinto spirits, or Kami, live invisibly alongside modern society. 16-year-old Haru accidentally makes a blood contract with a powerful, sealed fox deity, Senko. Haru is thrust into the spiritual underworld to protect Kyoto from negative miasma entities.",
        backdropUrl: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1200",
        posterUrl: "https://images.unsplash.com/photo-1580477667995-2b94f01c9516?q=80&w=400",
        rating: 8.3,
        year: 2025,
        duration: "12 Episodes",
        genres: ["Anime", "Fantasy", "Mystery"],
        cast: ["Natsuki Hanae", "Ayane Sakura"],
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4"
      }
    ]
  },
  {
    id: "fc2",
    title: "African Cinema & Editorial Richness",
    items: [
      MOCK_MEDIA[1], // Shadow of Kêr Nafy
      MOCK_MEDIA[3], // Rhythms of the Sahel
      {
        id: "af1",
        title: "The Sands of Agadez",
        type: "movie",
        description: "A mythical desert Tuareg warrior must defend his oasis from gold cartel militia.",
        synopsis: "Agadez, Niger. The gate of the Sahara. Ibrahim, a Tuareg desert guide, discovers that a greedy mining syndicate has falsified geological deeds to tear down his family's generational palm oasis. He organizes a coalition of local nomadic tribes to wage a non-violent but high-stakes blockade, facing armed corporate mercenaries.",
        backdropUrl: "https://images.unsplash.com/photo-1547234935-80c7145ec969?q=80&w=1200",
        posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400",
        rating: 8.8,
        year: 2025,
        duration: "1h 56m",
        genres: ["Drama", "Action"],
        cast: ["Omar Sy", "Tuareg Nomadic Ensemble"],
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-drone-shot-of-a-beautiful-river-flowing-through-the-41926-large.mp4"
      },
      {
        id: "af2",
        title: "Lagos Heights",
        type: "series",
        description: "Follow the lives, loves, and cutthroat business deals of billionaires in the Victoria Island district of Lagos.",
        synopsis: "In the skyscrapers of Victoria Island, Lagos, five family conglomerates clash over a multi-billion dollar seaport construction bid. Betrayals, romance, and political schemes unfold as the younger heirs attempt to reform their parents' corrupt empires.",
        backdropUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=1200",
        posterUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=400",
        rating: 8.6,
        year: 2026,
        duration: "1 Season (10 Ep.)",
        genres: ["Series", "Drama"],
        cast: ["Genevieve Nnaji", "Inidima Okojie"],
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-audience-raising-hands-in-a-concert-40292-large.mp4"
      }
    ]
  },
  {
    id: "fc3",
    title: "Most Popular Series",
    items: [
      MOCK_MEDIA[1], // Kêr Nafy
      MOCK_MEDIA[9], // Kings of Asphalt
      {
        id: "s3",
        title: "Signal Lost",
        type: "series",
        description: "An oceanographic station receives radio transmissions from a deep ocean trench that match transcripts from a 1970s lost space mission.",
        synopsis: "A team of researchers at the oceanic Challenger Deep receives a structured VHF transmission. The coordinates indicate it's coming from 11,000 meters down, but the voice matches Commander Arthur Pendelton, who disappeared in deep orbit during the 1974 Pioneer mission. As the transmission speaks of an intelligent, underwater rift, the team's facility is locked down by military intelligence.",
        backdropUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200",
        posterUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=400",
        rating: 9.0,
        year: 2025,
        duration: "3 Seasons (24 Ep.)",
        genres: ["Series", "Sci-Fi", "Mystery"],
        cast: ["David Harbour", "Elizabeth Debicki"],
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-astronaut-exploring-a-new-planet-surface-42999-large.mp4"
      }
    ]
  }
];
