// Fake tweet generator for demo — ~110 realistic pollution reports for Guwahati

const HANDLES = [
  "@guwahati_updates",
  "@gplus_guwahati",
  "@pratidin_time",
  "@ne_now_news",
  "@times_of_assam",
  "@assam_tribune",
  "@pcb_assam",
  "@cpcb_official",
  "@gmc_guwahati",
  "@gmda_guwahati",
  "@guwahati_traffic_police",
  "@aqi_guwahati",
  "@airwatch_ghy",
  "@green_guwahati_ngo",
  "@clean_guwahati",
  "@brahmaputra_greens",
  "@local_journo_ghy",
  "@ward_reporter_ghy",
  "@citizen_reporter1",
];

const SOURCES = ["twitter", "twitter", "twitter", "reddit"];

// Images available for image tweets (served from /images/)
const IMAGE_URLS = [
  "/images/smoke1.jpeg",
  "/images/dust1.jpeg",
  "/images/burning1.jpeg",
];

const TWEET_TEMPLATES = [
  // ===== GARBAGE BURNING (Boragaon dump narrative + street burning) =====
  {
    text: "🚨 BREAKING: Massive fire at the Boragaon dump yard. Thick black smoke spreading over West Guwahati. Residents complaining of burning eyes. #GuwahatiPollution",
    locations: ["boragaon"],
    imageUrl: "/images/burning1.jpeg",
  },
  {
    text: "The Boragaon landfill is burning AGAIN. Toxic smoke everywhere, we can't breathe in Gorchuk. This happens every week and nobody acts. 🆘",
    locations: ["boragaon", "gorchuk"],
  },
  {
    text: "Dump fire at Boragaon still burning since morning. Children coughing in nearby schools. Where is GMC? #CleanAirGuwahati",
    locations: ["boragaon"],
    imageUrl: "/images/burning1.jpeg",
  },
  {
    text: "Someone burning garbage openly near Fancy Bazaar market. Burning smell everywhere, shopkeepers complaining of throat irritation.",
    locations: ["fancy bazaar"],
  },
  {
    text: "Open burning of waste behind Paltan Bazaar railway station right now. Thick smoke drifting into the market area. Please send inspection team @gmc_guwahati",
    locations: ["paltan bazaar"],
  },
  {
    text: "Burning plastic smell in Hatigaon since evening. Someone is burning trash in the empty plot near the bus stop. Eyes watering badly.",
    locations: ["hatigaon"],
  },
  {
    text: "I can see garbage on fire near the Beltola bazaar. Smoke is rising and spreading towards residential blocks. Happening now.",
    locations: ["beltola"],
    imageUrl: "/images/burning1.jpeg",
  },
  {
    text: "Tyre burning reported near Gorchuk industrial area. Acrid black smoke visible from the highway. Extremely dangerous for nearby residents.",
    locations: ["gorchuk"],
  },
  {
    text: "Every night someone burns waste near Bhetapara chariali. Tonight the burning smell is unbearable, my kids are coughing continuously.",
    locations: ["bhetapara"],
  },
  {
    text: "Garbage heap set on fire near Lokhra road. Flames visible, smoke covering the whole lane. Fire tender needed urgently. #Guwahati",
    locations: ["lokhra"],
  },
  {
    text: "Update: Boragaon dump fire under control but smoldering continues. PCB Assam monitoring air quality in surrounding areas. Avoid outdoor activity in West Guwahati.",
    locations: ["boragaon"],
  },
  {
    text: "Massive garbage burning near Sawkuchi. The smoke has covered the entire area, visibility very low on the road. 🚨",
    locations: ["sawkuchi"],
  },
  {
    text: "Residents of Kahilipara report burning waste smell every morning around 6am. Chronic open burning in the hill slope area. GMC please act.",
    locations: ["kahilipara"],
  },
  {
    text: "Just witnessed workers burning leaves and plastic together near Nabin Nagar. Thick white smoke drifting into homes. This is illegal!",
    locations: ["nabin nagar"],
  },
  {
    text: "Trash fire near Adabari bus terminus spreading fast. Burning garbage right next to the fuel station — extremely dangerous! 🆘 #Guwahati",
    locations: ["adabari"],
    imageUrl: "/images/burning1.jpeg",
  },
  {
    text: "Open burning at the Santipur ghat area again. Smell of burning plastic across the riverside. Multiple complaints filed, zero action.",
    locations: ["santipur"],
  },
  {
    text: "Garbage burning near Geetanagar water tank. Smoke entering houses, elderly residents having breathing difficulty. Please share. #CleanAir",
    locations: ["geetanagar"],
  },
  {
    text: "Fire at the waste collection point in Rehabari. Burning waste smell up to the flyover. Whole colony affected since 2 hours.",
    locations: ["rehabari"],
  },

  // ===== INDUSTRIAL SMOKE (Noonmati refinery + Bamunimaidan + Pandu narrative) =====
  {
    text: "Unusual black smoke from the Noonmati refinery stack this morning. Strong chemical smell in Geetanagar and Chandmari. Anyone else noticing this?",
    locations: ["noonmati", "geetanagar", "chandmari"],
    imageUrl: "/images/smoke1.jpeg",
  },
  {
    text: "Chemical smell near Noonmati refinery area very strong today. Residents report headache and nausea. PCB Assam should check emission levels immediately.",
    locations: ["noonmati"],
  },
  {
    text: "Factory smoke from the Bamunimaidan industrial estate has covered the whole area. Dense smoke visible from Chandmari flyover. #GuwahatiAir",
    locations: ["bamunimaidan", "chandmari"],
    imageUrl: "/images/smoke1.jpeg",
  },
  {
    text: "The small factories in Bamunimaidan run at night and release industrial fumes. Every morning our terrace is covered in black soot. Who regulates this?",
    locations: ["bamunimaidan"],
  },
  {
    text: "Smoke belching from a unit near Pandu port since afternoon. Industrial pollution drifting over the Brahmaputra towards North Guwahati.",
    locations: ["pandu", "north guwahati"],
  },
  {
    text: "🚨 Reports of a gas leak smell near the Noonmati refinery boundary wall. Residents advised to keep windows closed. Emergency teams on the way.",
    locations: ["noonmati"],
  },
  {
    text: "Brick kiln smoke near Amingaon industrial area making the air unbreathable. Workers on site with zero protection. NGT norms openly violated.",
    locations: ["amingaon"],
  },
  {
    text: "Strong sulphur smell in Narengi tonight. Possibly from the refinery side. Air feels heavy, throat burning. Anyone else in East Guwahati?",
    locations: ["narengi", "noonmati"],
  },
  {
    text: "Industrial emission from the Amingaon side visible across the river this morning. Grey plume drifting towards the city. #GuwahatiPollution",
    locations: ["amingaon"],
    imageUrl: "/images/smoke1.jpeg",
  },
  {
    text: "PCB Assam inspection team visited units in Bamunimaidan after repeated complaints of chemical fumes. Two units found operating without emission clearance.",
    locations: ["bamunimaidan"],
  },
  {
    text: "The plant near Pandu released thick smoke around 5am today. I have video proof. Industrial pollution is choking Maligaon residents daily.",
    locations: ["pandu", "maligaon"],
  },
  {
    text: "Chimney smoke from the industrial units near Gorchuk continues unchecked. Evening air in South Guwahati smells of burning chemicals.",
    locations: ["gorchuk"],
  },

  // ===== VEHICLE POLLUTION (GS Road / junctions narrative) =====
  {
    text: "Stuck at Ganeshguri flyover — the diesel smoke from old city buses here is unbearable. Traffic fumes making everyone cover their faces. #GSRoad",
    locations: ["ganeshguri", "gs road"],
  },
  {
    text: "Black smoke from a truck near Jalukbari junction. Vehicle emission checks are a joke in this city. PUC expired vehicles everywhere.",
    locations: ["jalukbari"],
  },
  {
    text: "Evening traffic jam smoke at Six Mile is getting worse every day. Exhaust fumes + dust = can't even stand at the bus stop. @guwahati_traffic_police",
    locations: ["six mile"],
  },
  {
    text: "The auto stand near Paltan Bazaar has 20 autos idling and releasing exhaust smoke continuously. Commuters coughing while waiting.",
    locations: ["paltan bazaar"],
  },
  {
    text: "Khanapara junction during office hours: hundreds of vehicles, thick exhaust fumes, zero traffic management. Air quality here must be hazardous.",
    locations: ["khanapara"],
  },
  {
    text: "Old city buses on GS Road belching black smoke again. Just saw one near Bhangagarh that covered the entire road in diesel fumes. 🚌💨",
    locations: ["gs road", "bhangagarh"],
  },
  {
    text: "Vehicular pollution at Ulubari crossing is at its worst during evening rush. Traffic fumes visible under the streetlights like fog.",
    locations: ["ulubari"],
  },
  {
    text: "Trucks queuing at Jalukbari for the bridge release diesel smoke for hours. Adabari residents breathe this every single day.",
    locations: ["jalukbari", "adabari"],
  },
  {
    text: "Traffic police at Ganeshguri wearing masks now — vehicle smoke at this junction is that bad. When will the PUC enforcement drive start?",
    locations: ["ganeshguri"],
  },
  {
    text: "Diesel fumes from the interstate buses at the Adabari terminus fill the whole neighbourhood every morning. Vehicle emission is out of control.",
    locations: ["adabari"],
  },
  {
    text: "GS Road near Christian Basti right now: bumper-to-bumper traffic, exhaust smoke everywhere, visibility low. Avoid if you have asthma.",
    locations: ["gs road", "christian basti"],
  },
  {
    text: "The VIP Road stretch is full of traffic fumes today due to diversion. Vehicles idling for 30+ minutes releasing exhaust continuously.",
    locations: ["vip road"],
  },

  // ===== CONSTRUCTION DUST (Six Mile flyover + city sites narrative) =====
  {
    text: "The flyover construction at Six Mile has turned the area into a dust bowl. Dust cloud everywhere, shops covered in cement dust. #GuwahatiDust",
    locations: ["six mile"],
    imageUrl: "/images/dust1.jpeg",
  },
  {
    text: "Uncovered trucks carrying sand on VIP Road spilling everywhere. Road dust flying into eyes of two-wheeler riders. Very dangerous.",
    locations: ["vip road"],
  },
  {
    text: "Massive demolition at Ganeshguri without any water spraying. Dust cloud covered the whole junction for an hour. Where are the dust control norms?",
    locations: ["ganeshguri"],
    imageUrl: "/images/dust1.jpeg",
  },
  {
    text: "Construction dust from the new commercial complex near Bhangagarh is unbearable. My balcony is covered in dust within an hour of cleaning.",
    locations: ["bhangagarh"],
  },
  {
    text: "The road widening work near Basistha chariali has been generating dust for 3 weeks. Dusty road, zero water sprinkling, residents suffering.",
    locations: ["basistha"],
  },
  {
    text: "Stone crusher operating near Sawkuchi hills covering nearby homes in fine dust. Children in the area coughing. This needs urgent inspection.",
    locations: ["sawkuchi"],
  },
  {
    text: "Dust everywhere near Khanapara due to the ongoing drain construction. Commuters covering faces, shopkeepers spraying water themselves.",
    locations: ["khanapara"],
  },
  {
    text: "Construction site near Rukminigaon operating without dust barriers. Cement dust drifting into the residential lanes since morning.",
    locations: ["rukminigaon"],
  },
  {
    text: "The Hatigaon road repair work left mounds of sand uncovered. Every passing vehicle raises a dust cloud. Whole stretch is hazy with dust.",
    locations: ["hatigaon"],
    imageUrl: "/images/dust1.jpeg",
  },
  {
    text: "Demolition dust from the old building site near Pan Bazaar drifting into the market. Vendors complaining of eye irritation and cough.",
    locations: ["pan bazaar"],
  },
  {
    text: "Dust pollution near Panjabari due to uncovered construction material transport. GMDA needs to enforce covering norms on sand trucks.",
    locations: ["panjabari"],
  },
  {
    text: "Road dust + construction dust at Beltola survey area making morning walks impossible. Air feels heavy with fine dust particles.",
    locations: ["beltola"],
  },

  // ===== GARBAGE DUMPING (stench/waste narrative) =====
  {
    text: "Garbage not collected in Uzan Bazar for 5 days. Rotting garbage pile at the lane corner, stench unbearable. @gmc_guwahati please act.",
    locations: ["uzan bazar"],
  },
  {
    text: "Illegal dumping of waste into the Bharalu river near Bharalumukh continues. The foul smell has made the whole area unlivable.",
    locations: ["bharalumukh"],
  },
  {
    text: "Someone has dumped a truckload of waste on the empty plot near Kahilipara road. Rotting waste, stray animals, stench everywhere.",
    locations: ["kahilipara"],
  },
  {
    text: "The overflowing dustbin near Chandmari flyover hasn't been cleared in a week. Garbage everywhere on the footpath now. #CleanGuwahati",
    locations: ["chandmari"],
  },
  {
    text: "Medical waste dumped openly behind the diagnostic centre near Silpukhuri. This is a serious health hazard, needs immediate inspection.",
    locations: ["silpukhuri"],
  },
  {
    text: "Garbage heap growing daily at the Fatasil Ambari market corner. Foul smell spreading, water logging making it worse. Multiple complaints ignored.",
    locations: ["fatasil ambari"],
  },
  {
    text: "The lane behind Lachit Nagar has become an illegal dumping ground. Construction debris + household waste dumped every night.",
    locations: ["lachit nagar"],
  },
  {
    text: "Overflowing garbage at the Beltola weekly market site. Two days after market day and the waste is still lying there rotting.",
    locations: ["beltola"],
  },
  {
    text: "Stench from the waste transfer station near Ulubari is unbearable this week. Garbage trucks leaking on the main road too.",
    locations: ["ulubari"],
  },
  {
    text: "Garbage pile at the Hatigaon chariali growing for a week. Residents say collection truck comes once in 4 days. Foul smell in whole area.",
    locations: ["hatigaon"],
  },
  {
    text: "Waste dumped along the Basistha river bank again. Plastic, household garbage, everything going straight into the water. Shameful.",
    locations: ["basistha"],
  },
  {
    text: "The service lane on GS Road near Dispur has rotting garbage lying for days. Stench hits you the moment you enter. #GuwahatiWaste",
    locations: ["gs road", "dispur"],
  },

  // ===== SMOG / AIR QUALITY (city-wide narrative) =====
  {
    text: "AQI near Khanapara crossed 280 this evening. Air quality in South Guwahati is officially very poor. Avoid outdoor exercise. #GuwahatiAQI",
    locations: ["khanapara"],
  },
  {
    text: "Thick smog over the city this morning. From my rooftop in Chandmari I can't see beyond 500 meters. Air pollution is choking Guwahati.",
    locations: ["chandmari"],
    imageUrl: "/images/smoke1.jpeg",
  },
  {
    text: "The haze over Dispur today is not fog, it's smog. PM2.5 levels at 180+ as per the monitoring station. Wear masks outside.",
    locations: ["dispur"],
  },
  {
    text: "Winter smog settling over Guwahati earlier than usual. Hazy sky since morning, sun barely visible from Paltan Bazaar. #AirQuality",
    locations: ["paltan bazaar", "guwahati"],
  },
  {
    text: "Air quality alert: AQI at the Boragaon monitoring point at 320 due to the landfill fire. Hazardous for sensitive groups in West Guwahati.",
    locations: ["boragaon"],
  },
  {
    text: "Difficult to breathe outside today in Ganeshguri. The mix of traffic fumes and smog is making my throat burn. Air is heavy.",
    locations: ["ganeshguri"],
  },
  {
    text: "Grey sky over the whole city — smog trapped due to no wind. Zoo Road area visibility low, polluted air smell everywhere.",
    locations: ["zoo road"],
  },
  {
    text: "PM10 levels near the Six Mile construction corridor at 250+. Combination of dust and smog making air quality hazardous. #GuwahatiAir",
    locations: ["six mile"],
  },
  {
    text: "Morning walkers at Khanapara complaining of hazy, smoky air the whole week. AQI consistently above 200 here. When does this become an emergency?",
    locations: ["khanapara"],
  },
  {
    text: "Smog layer visible over the Brahmaputra from Uzan Bazar ghat. The city's polluted air is now visible to the naked eye. 📷",
    locations: ["uzan bazar"],
    imageUrl: "/images/smoke1.jpeg",
  },

  // ===== ROMANIZED REGIONAL-LANGUAGE REPORTS =====
  {
    text: "Boragaon or dump ot abar juise, dhuan re gota area bhori gol. Xah loba nuwari. Kunuba GMC k khabar diok! 🆘",
    locations: ["boragaon"],
  },
  {
    text: "Six Mile ot flyover or kaam or karone dhuli re gota rasta dhaki gol. Dhulo uri ase sob phale, chokut soma dhuli.",
    locations: ["six mile"],
  },
  {
    text: "Fancy Bazaar or pisor golit kunuba aborjona puri ase. Pura gondho ahise, dhuan uthi ase. Keba din dhori ei kaam cholise.",
    locations: ["fancy bazaar"],
  },
  {
    text: "Noonmati refinery or pora aji beya chemical gondho ahise. Murta bikhai ase, ghor or bhitorot o gondho. Anyone else?",
    locations: ["noonmati"],
  },
  {
    text: "GS Road ot gari bor or dhuan asahaniyo hoi porise. Bus or pora kola dhuan olai ase, saans nahi le paa rahe hum log signal pe.",
    locations: ["gs road"],
  },
  {
    text: "Hatigaon chariali ot garbage or pile din din dangor hoi ase. Durgondho re gota elaka bhori porise. GMC kot ase?",
    locations: ["hatigaon"],
  },
  {
    text: "Ulubari me kachra jal raha hai khule me, dhuan se pura mohalla bhar gaya. Bacche khaas rahe hai. Koi inspection karo bhai. 🚨",
    locations: ["ulubari"],
  },
  {
    text: "Khanapara or phale aji bohut kuwali/smog dekha gol. AQI bohut beya buli monitoring station e koise. Mask pindhi olabo.",
    locations: ["khanapara"],
  },

  // ===== FULL-SCRIPT REGIONAL-LANGUAGE REPORTS (exercise the translator) =====
  {
    text: "বৰাগাঁৱৰ ডাম্পিং গ্ৰাউণ্ডত আকৌ জুই লাগিছে। ধোঁৱাৰে গোটেই অঞ্চল ভৰি পৰিছে, উশাহ লব নোৱাৰি। শিশুসকলে কাহি আছে।",
    locations: ["boragaon"],
  },
  {
    text: "গণেশগুৰিত গাড়ীৰ ধোঁৱাত অৱস্থা ভয়াৱহ। চকু জ্বলিছে, ডিঙি বিষাইছে। ট্ৰেফিক পুলিচে কিবা কৰক।",
    locations: ["ganeshguri"],
  },
  {
    text: "ছয়মাইলত নিৰ্মাণৰ ধূলিয়ে ৰাস্তা ঢাকি পেলাইছে। ধূলিৰ কাৰণে একো দেখা নাযায়, দোকানবোৰ ধূলিৰে ভৰি পৰিছে।",
    locations: ["six mile"],
  },
  {
    text: "उलुबारी में खुले में कचरा जलाया जा रहा है। धुएं से पूरा मोहल्ला भर गया है, सांस लेना मुश्किल है। बच्चे खांस रहे हैं।",
    locations: ["ulubari"],
  },
  {
    text: "নুনমাটিৰ ৰিফাইনাৰীৰ পৰা অহা ৰাসায়নিক গোন্ধত চান্দমাৰিৰ মানুহে কষ্ট পাইছে। মূৰ বিষাইছে, বমি ভাব হৈছে।",
    locations: ["noonmati", "chandmari"],
  },
  {
    text: "খানাপাৰাত আজি ধোঁৱা-কুঁৱলীৰে আকাশ ঢাকি আছে। বায়ুৰ মান অতি বেয়া, ৰাতিপুৱা খোজ কঢ়া লোকসকলে সমস্যাত পৰিছে।",
    locations: ["khanapara"],
  },

  // ===== OFFICIAL / AGENCY UPDATES =====
  {
    text: "PCB Assam air quality bulletin: AQI Guwahati city average 218 (Poor). Boragaon 310 (Very Poor), Khanapara 265, Noonmati 240. Sensitive groups avoid outdoor exposure.",
    locations: ["boragaon", "khanapara", "noonmati"],
  },
  {
    text: "GMC update: Cleanup crew dispatched to clear the garbage accumulation at Uzan Bazar and Chandmari. Collection schedule being restored across affected wards.",
    locations: ["uzan bazar", "chandmari"],
  },
  {
    text: "Traffic advisory: Expect congestion and high vehicle emission levels near Six Mile due to flyover work. Use alternate routes via VIP Road.",
    locations: ["six mile", "vip road"],
  },
  {
    text: "CPCB monitoring alert: PM2.5 spike detected at the Khanapara continuous monitoring station. Hourly average 185 µg/m³ at 8 AM. #AirQuality",
    locations: ["khanapara"],
  },
  {
    text: "GMDA notice issued to construction site near Rukminigaon for operating without dust mitigation measures. Site inspection scheduled this week.",
    locations: ["rukminigaon"],
  },
];

// ===== NOISE TEMPLATES — decoys that mention smoke/fire/dust keywords but are NOT pollution reports =====
const NOISE_TEMPLATES = [
  {
    text: "This new track by the Guwahati rapper is straight fire 🔥🔥 the whole album is smoke, no skips!",
    locations: [],
    isNoise: true,
  },
  {
    text: "lol remember the smog last Diwali when we couldn't see the fireworks 😂 good times",
    locations: [],
    isNoise: true,
  },
  {
    text: "MEGA FIRE SALE at our Paltan Bazaar showroom!! Up to 70% off, offers smoking hot 🔥 Link in bio, promo code SMOKE70",
    locations: ["paltan bazaar"],
    isNoise: true,
  },
  {
    text: "Just watched a documentary about air pollution in Delhi. Scary stuff. Rating: 4 stars out of 5.",
    locations: [],
    isNoise: true,
  },
  {
    text: "BBQ night at our rooftop in Six Mile! The grill smoke, the music, the vibes 😍 #weekend",
    locations: ["six mile"],
    isNoise: true,
  },
  {
    text: "Imagine if Guwahati ever got smog like Beijing. What if we all had to wear masks forever? Hypothetically speaking.",
    locations: [],
    isNoise: true,
  },
  {
    text: "throwback to 2019 when the Boragaon dump caught fire for a whole week. old photo from my terrace #tbt",
    locations: ["boragaon"],
    isNoise: true,
  },
  {
    text: "My mixtape is pure fire, dropping this Friday 🔥 subscribe to my channel, link in bio!",
    locations: [],
    isNoise: true,
  },
  {
    text: "The tandoor smoke at this new Ganeshguri restaurant means the kebabs are legit 😋 food review coming soon",
    locations: ["ganeshguri"],
    isNoise: true,
  },
  {
    text: "haha my gym trainer said I was on fire today, smoked everyone in the spin class lmao 💪",
    locations: [],
    isNoise: true,
  },
  {
    text: "Movie review: the new action film has a massive smoke-filled climax scene shot in Assam. Worth watching!",
    locations: [],
    isNoise: true,
  },
  {
    text: "Buy our new incense sticks — fill your home with divine fragrance smoke 🙏 Order now, discount code POOJA20",
    locations: [],
    isNoise: true,
  },
  {
    text: "remember when we used to burn crackers all night during Diwali years ago? nostalgia hits different",
    locations: [],
    isNoise: true,
  },
  {
    text: "Campfire and old monk by the Brahmaputra this weekend 🏕️ who's in? #camping",
    locations: [],
    isNoise: true,
  },
  {
    text: "This biryani place near Khanapara is fire 🔥 the smoky flavour is unmatched. 5 stars.",
    locations: ["khanapara"],
    isNoise: true,
  },
  {
    text: "what if the fog tomorrow is actually just clouds coming down? asking for a friend lol",
    locations: [],
    isNoise: true,
  },
  {
    text: "GIVEAWAY TIME 🎉 Win a free air purifier! Follow, like and retweet to enter. Contest ends Sunday!",
    locations: [],
    isNoise: true,
  },
  {
    text: "hookah night with the boys at the new lounge in Christian Basti 💨 vibes were immaculate",
    locations: ["christian basti"],
    isNoise: true,
  },
  {
    text: "The dust settling after yesterday's cricket match... what a game! Assam smoked the opposition 😂",
    locations: [],
    isNoise: true,
  },
  {
    text: "Old video from my archive: morning mist over Uzan Bazar ghat in 2018. Looked like smoke on the water 🎵",
    locations: ["uzan bazar"],
    isNoise: true,
  },
  {
    text: "New vape shop opened near Zoo Road, they have all the flavours. smoke session this weekend?",
    locations: ["zoo road"],
    isNoise: true,
  },
  {
    text: "My cooking experiment filled the kitchen with smoke today lol 😂 burnt the paneer completely. jk it was edible",
    locations: [],
    isNoise: true,
  },
  {
    text: "reading a novel where the city is covered in permanent smog. dystopian fiction hits hard these days",
    locations: [],
    isNoise: true,
  },
  {
    text: "DOWNLOAD our new app for smoking hot deals on electronics! Click here → bit.ly/deals",
    locations: [],
    isNoise: true,
  },
  {
    text: "that time when our school bus broke down near Jalukbari and we thought the engine smoke was a fire 😂 class of 2015 memories",
    locations: ["jalukbari"],
    isNoise: true,
  },
  {
    text: "Fireworks show at the wedding last night was insane 🎆 the whole sky lit up. congrats to the couple!",
    locations: [],
    isNoise: true,
  },
  {
    text: "LIMITED OFFER: haze-proof sunglasses, perfect for bikers! Buy now, sale ends tonight!",
    locations: [],
    isNoise: true,
  },
  {
    text: "the way she smoked past the defenders in yesterday's match 🔥 what a goal!",
    locations: [],
    isNoise: true,
  },
  {
    text: "Bonfire party at the Azara farmhouse next weekend. BYOB. winter is here! 🔥",
    locations: ["azara"],
    isNoise: true,
  },
  {
    text: "if u squint the clouds over the city today look like dragon smoke lol #random",
    locations: [],
    isNoise: true,
  },
];

// Noise-specific handles (low credibility)
const NOISE_HANDLES = [
  "@random_user_420",
  "@meme_lord_ghy",
  "@bot_farm_7",
  "@spam_account_x",
  "@movie_reviewer_ne",
  "@throwback_daily",
  "@promo_deals_india",
  "@troll_master_69",
];

// Account metadata profiles
const ACCOUNT_PROFILES = {
  // Official — high trust
  "@pcb_assam": {
    isVerified: true,
    followerCount: 185000,
    accountAgeDays: 3650,
  },
  "@cpcb_official": {
    isVerified: true,
    followerCount: 420000,
    accountAgeDays: 4380,
  },
  "@gmc_guwahati": {
    isVerified: true,
    followerCount: 150000,
    accountAgeDays: 2920,
  },
  "@gmda_guwahati": {
    isVerified: true,
    followerCount: 95000,
    accountAgeDays: 2555,
  },
  "@guwahati_traffic_police": {
    isVerified: true,
    followerCount: 210000,
    accountAgeDays: 3285,
  },
  // News — verified
  "@assam_tribune": {
    isVerified: true,
    followerCount: 320000,
    accountAgeDays: 4015,
  },
  "@gplus_guwahati": {
    isVerified: true,
    followerCount: 145000,
    accountAgeDays: 2190,
  },
  "@pratidin_time": {
    isVerified: true,
    followerCount: 280000,
    accountAgeDays: 2555,
  },
  "@ne_now_news": {
    isVerified: true,
    followerCount: 110000,
    accountAgeDays: 1825,
  },
  "@times_of_assam": {
    isVerified: false,
    followerCount: 65000,
    accountAgeDays: 1460,
  },
  "@guwahati_updates": {
    isVerified: false,
    followerCount: 48000,
    accountAgeDays: 1460,
  },
  // Environment / monitoring
  "@aqi_guwahati": {
    isVerified: false,
    followerCount: 31000,
    accountAgeDays: 1460,
  },
  "@airwatch_ghy": {
    isVerified: false,
    followerCount: 19000,
    accountAgeDays: 950,
  },
  "@green_guwahati_ngo": {
    isVerified: false,
    followerCount: 24000,
    accountAgeDays: 1825,
  },
  "@clean_guwahati": {
    isVerified: false,
    followerCount: 12000,
    accountAgeDays: 730,
  },
  "@brahmaputra_greens": {
    isVerified: false,
    followerCount: 9500,
    accountAgeDays: 620,
  },
  // Journalists
  "@local_journo_ghy": {
    isVerified: false,
    followerCount: 5200,
    accountAgeDays: 780,
  },
  "@ward_reporter_ghy": {
    isVerified: false,
    followerCount: 3100,
    accountAgeDays: 365,
  },
  // Citizens
  "@citizen_reporter1": {
    isVerified: false,
    followerCount: 820,
    accountAgeDays: 210,
  },
  // Noise handles — low trust
  "@random_user_420": {
    isVerified: false,
    followerCount: 120,
    accountAgeDays: 15,
  },
  "@meme_lord_ghy": {
    isVerified: false,
    followerCount: 3500,
    accountAgeDays: 90,
  },
  "@bot_farm_7": { isVerified: false, followerCount: 45, accountAgeDays: 5 },
  "@spam_account_x": { isVerified: false, followerCount: 8, accountAgeDays: 2 },
  "@movie_reviewer_ne": {
    isVerified: false,
    followerCount: 2200,
    accountAgeDays: 340,
  },
  "@throwback_daily": {
    isVerified: false,
    followerCount: 6800,
    accountAgeDays: 450,
  },
  "@promo_deals_india": {
    isVerified: false,
    followerCount: 15000,
    accountAgeDays: 60,
  },
  "@troll_master_69": {
    isVerified: false,
    followerCount: 4100,
    accountAgeDays: 75,
  },
};

// Generate realistic engagement metrics based on severity & source
function generateEngagement(handle, isNoise = false) {
  const profile = ACCOUNT_PROFILES[handle];
  const followers = profile?.followerCount || 100;

  if (isNoise) {
    // Noise tweets get low or spammy engagement
    return {
      likes: Math.floor(Math.random() * 15),
      retweets: Math.floor(Math.random() * 5),
      replies: Math.floor(Math.random() * 8),
      views: Math.floor(Math.random() * 500),
    };
  }

  // Real tweets: engagement scales with follower count
  const baseMultiplier = Math.log10(followers + 1) / 5;
  const viralChance = Math.random();

  let likes = Math.floor(
    followers * baseMultiplier * (0.02 + Math.random() * 0.08),
  );
  let retweets = Math.floor(likes * (0.2 + Math.random() * 0.4));
  let replies = Math.floor(likes * (0.05 + Math.random() * 0.15));
  let views = Math.floor(likes * (5 + Math.random() * 15));

  // Occasional viral spike
  if (viralChance > 0.85) {
    const multiplier = 3 + Math.random() * 7;
    likes = Math.floor(likes * multiplier);
    retweets = Math.floor(retweets * multiplier);
    replies = Math.floor(replies * multiplier * 0.5);
    views = Math.floor(views * multiplier);
  }

  return { likes, retweets, replies, views };
}

let tweetIndex = 0;
let noiseCounter = 0;

function generateTweet() {
  // Mix in noise tweets: roughly 1 in 5 tweets is noise
  const isNoiseTweet = Math.random() < 0.2;

  if (isNoiseTweet) {
    const template = NOISE_TEMPLATES[noiseCounter % NOISE_TEMPLATES.length];
    noiseCounter++;

    const handle =
      NOISE_HANDLES[Math.floor(Math.random() * NOISE_HANDLES.length)];
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const timestamp = new Date(
      Date.now() - Math.random() * 5 * 60 * 1000,
    ).toISOString();

    return {
      id: `tw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      text: template.text,
      handle,
      source,
      timestamp,
      hintLocations: template.locations,
      isNoise: true,
      engagement: generateEngagement(handle, true),
      accountMeta: ACCOUNT_PROFILES[handle] || {
        isVerified: false,
        followerCount: 50,
        accountAgeDays: 10,
      },
    };
  }

  const template = TWEET_TEMPLATES[tweetIndex % TWEET_TEMPLATES.length];
  tweetIndex++;

  const handle = HANDLES[Math.floor(Math.random() * HANDLES.length)];
  const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
  const timestamp = new Date(
    Date.now() - Math.random() * 5 * 60 * 1000,
  ).toISOString();

  return {
    id: `tw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    text: template.text,
    handle,
    source,
    timestamp,
    hintLocations: template.locations,
    imageUrl: template.imageUrl || null,
    isNoise: false,
    engagement: generateEngagement(handle, false),
    accountMeta: ACCOUNT_PROFILES[handle] || {
      isVerified: false,
      followerCount: 1000,
      accountAgeDays: 365,
    },
  };
}

/**
 * Generate a batch of tweets for historical simulation
 * @param {number} count
 * @param {number} hoursBack - spread tweets over this many hours
 */
function generateHistoricalBatch(count = 50, hoursBack = 48) {
  const tweets = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    // 15% noise in historical data
    const isNoise = Math.random() < 0.15;
    const templatePool = isNoise ? NOISE_TEMPLATES : TWEET_TEMPLATES;
    const template = templatePool[i % templatePool.length];
    const handlePool = isNoise ? NOISE_HANDLES : HANDLES;
    const handle = handlePool[Math.floor(Math.random() * handlePool.length)];
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];

    const progress = i / count;
    const hoursAgo = hoursBack * (1 - Math.pow(progress, 0.7));
    const timestamp = new Date(now - hoursAgo * 3600 * 1000).toISOString();

    tweets.push({
      id: `tw_hist_${i}_${Math.random().toString(36).substring(2, 8)}`,
      text: template.text,
      handle,
      source,
      timestamp,
      hintLocations: template.locations,
      imageUrl: template.imageUrl || null,
      isNoise: isNoise,
      engagement: generateEngagement(handle, isNoise),
      accountMeta: ACCOUNT_PROFILES[handle] || {
        isVerified: false,
        followerCount: 500,
        accountAgeDays: 180,
      },
    });
  }

  return tweets.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export {
  generateTweet,
  generateHistoricalBatch,
  TWEET_TEMPLATES,
  NOISE_TEMPLATES,
  ACCOUNT_PROFILES,
};
