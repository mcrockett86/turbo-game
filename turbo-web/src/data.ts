// ===== Shared types for data module =====
import type { Zone, Room, Item, Threat, Dog, Companion } from '@/types';

// ===== DOG DATA =====
export const DOGS: Record<string, Dog> = {
  turbo: {
    id: 'turbo',
    name: 'Turbo',
    breed: 'Alaskan Husky',
    trait: '🏃 Speed',
    traitDesc: 'Moves faster, escapes threats quicker',
    colors: { fur: ['#ffffff', '#3a3a3a', '#8B4513'], accent: '#4a9eff' },
    personality: ['adventurous', 'loyal', 'curious'],
    lines: {
      intro: "The gate was open. I don't remember opening it... but the world is OUTSIDE. And I'm going to explore EVERYTHING.",
      happy: "Woof! Best day ever!",
      scared: "What was that?! ...I'm not scared. I'm just... cautiously observant.",
      hint: "I smell something familiar... like home?",
      combat: "Leave it to me! *growls bravely*",
      foundFriend: "A new friend?! *wags tail furiously*"
    }
  },
  watson: {
    id: 'watson',
    name: 'Watson',
    breed: 'German Shepherd',
    trait: '🛡️ Brave',
    traitDesc: 'Combat is easier, intimidation works',
    colors: { fur: ['#2a1a0a', '#4a2a0a', '#1a0a00'], accent: '#d4a020' },
    personality: ['brave', 'protective', 'disciplined'],
    lines: {
      intro: "I don't know where I am, but if anything threatens anyone, it'll answer to me.",
      happy: "*stays alert but tail gives a small wag*",
      scared: "*ears flatten, then stands taller* I'm fine. Really.",
      hint: "That direction... I should investigate.",
      combat: "Not on my watch. *steps forward*",
      foundFriend: "A fellow warrior? ...Do you know the way home?"
    }
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    breed: 'Golden Retriever',
    trait: '😊 Happiness',
    traitDesc: 'Companions boost more, morale boost to all',
    colors: { fur: ['#DAA520', '#FFD700', '#B8860B'], accent: '#ff9f43' },
    personality: ['friendly', 'optimistic', 'generous'],
    lines: {
      intro: "Oh wow! Everything is so big and new! I hope I make lots of friends!",
      happy: "This is the BEST thing that's ever happened! *does happy pirouette*",
      scared: "*whimpers* ...But I'll be brave for everyone!",
      hint: "Ooh! A clue! Maybe we're getting closer to home!",
      combat: "*barks confidently* They won't hurt my friends!",
      foundFriend: "A new friend?! *immediately starts playing*"
    }
  },
  walter: {
    id: 'walter',
    name: 'Walter',
    breed: 'English Bulldog',
    trait: '👃 Sniff',
    traitDesc: 'Finds food and hints faster',
    colors: { fur: ['#D2B48C', '#C4A882', '#8B7355'], accent: '#e07040' },
    personality: ['food-motivated', 'calm', 'stubborn'],
    lines: {
      intro: "I was napping... now I'm somewhere else. Hope there's food here.",
      happy: "*pants happily* Nothing beats a good day and a good snack.",
      scared: "*huffs* I'm not afraid of... *hears noise* ...of anything.",
      hint: "*sniff sniff* ...Yeah, that smells like home. Definitely home.",
      combat: "*stands his ground, looking like he's about to sneeze*",
      foundFriend: "*sniffs new dog* ...Do you have snacks? ...Wait, you're a friend?"
    }
  },
  beaux: {
    id: 'beaux',
    name: 'Beaux',
    breed: 'Chihuahua',
    trait: '🎒 Compact',
    traitDesc: 'Carries extra item in tiny bandana',
    colors: { fur: ['#F5DEB3', '#DEB887', '#D2B48C'], accent: '#ff6b81' },
    personality: ['tough', 'tiny', 'surprisingly brave'],
    lines: {
      intro: "I may be small, but I'm NOT insignificant. And I have a bandana. Look.",
      happy: "*tiny happy yips* I am the best dog. Everyone knows this.",
      scared: "*makes himself look bigger* I'm not scared! I'm just... very alert!",
      hint: "*ears perk up* I can smell it from here. Well, maybe two blocks away.",
      combat: "*barks at volume 11* Who's the boss now?! *is 8 inches tall*",
      foundFriend: "*sniffs* You're big. I'm... I'm not intimidated at all. *is very intimidated*"
    }
  }
};

// ===== COMPANIONS =====
export const COMPANIONS: Record<string, Companion> = {
  stray_buddy: {
    id: 'stray_buddy',
    name: 'Buddy',
    breed: 'Golden Retriever',
    trait: '🐾 Friendly',
    dialogue: [
      'Woof! Welcome to the park!',
      'Home is where the fence is. Which fence?',
      'I used to live near the big oak tree!',
      'Follow the scent posts — they lead somewhere!',
    ],
    color: '#DAA520',
    accentColor: '#FFD700',
    met: false,
    active: false,
  },
};

// ===== ZONES =====
export const ZONES: Record<string, Zone> = {
  suburban_streets: {
    id: 'suburban_streets',
    name: '🏘️ Suburban Streets',
    desc: 'Wide sidewalks, unfamiliar houses. The world is so big.',
    type: 'fp', // first-person
    rooms: [
      { id: 'start', name: 'Front Yard', w: 200, h: 150, d: 200, color: '#4a7a3a', exits: ['street_north', 'street_east'] },
      { id: 'street_north', name: 'North Street', w: 300, h: 120, d: 400, color: '#6a6a6a', exits: ['start', 'intersection'], features: [{type:'traffic', x:150, y:60, w:80, h:20, label:'🚗 Traffic'}] },
      { id: 'street_east', name: 'East Walk', w: 250, h: 100, d: 350, color: '#5a8a5a', exits: ['start', 'dog_park_gate'], features: [{type:'hint', x:100, y:50, w:30, h:30, label:'🦴 Bone', item:'bone'}] },
      { id: 'intersection', name: 'Street Intersection', w: 200, h: 150, d: 200, color: '#7a7a7a', exits: ['street_north', 'street_south', 'alley'], features: [{type:'choice', x:100, y:75, w:60, h:40, label:'Choose path'}] },
      { id: 'street_south', name: 'South Avenue', w: 350, h: 120, d: 300, color: '#6a6a6a', exits: ['intersection'], features: [{type:'door', x:175, y:60, w:40, h:50, label:'🚪 Door', locked:true, item:'key'}]},
      { id: 'alley', name: 'Back Alley', w: 180, h: 100, d: 300, color: '#3a3a4a', exits: ['intersection', 'shelter_entrance'], features: [{type:'cat', x:90, y:50, w:40, h:30, label:'🐱 Mean Cat'}] },
      { id: 'dog_park_gate', name: 'Dog Park Gate', w: 100, h: 80, d: 100, color: '#5a9a5a', exits: ['street_east'], isEntrance: true, entranceZone: 'dog_park' },
      { id: 'shelter_entrance', name: 'Shelter Door', w: 120, h: 100, d: 120, color: '#4a4a6a', exits: ['alley'], isEntrance: true, entranceZone: 'shelter' },
      { id: 'apt_gate', name: 'Apartment Gate', w: 100, h: 80, d: 100, color: '#7a6a5a', exits: ['street_south'], isEntrance: true, entranceZone: 'apartment' }
    ],
    music: 'suburban',
    hint: 'You see a squirrel. It reminds you of... something. A yard? With squirrels?'
  },
  dog_park: {
    id: 'dog_park',
    name: '🌳 Dog Park',
    desc: 'A bright, open space. Other dogs are everywhere!',
    type: 'tp',
    music: 'dog_park',
    skyColor: '#87CEEB',
    groundColor: '#4a7c3f',
    dogColor: '#d4a574',
    accentColor: '#ff6b35',
    companions: ['stray_buddy'],
    obstacles: [
      { type: 'fence', x: -8, z: -6, width: 6, height: 1.2, color: '#8B4513' },
      { type: 'fence', x: 8, z: 6, width: 5, height: 1.2, color: '#8B4513', rotation: Math.PI / 4 },
      { type: 'tree', x: -4, z: 3, height: 3, trunkColor: '#5a3a1a', leafColor: '#2d5a1e' },
      { type: 'tree', x: 5, z: -4, height: 2.5, trunkColor: '#5a3a1a', leafColor: '#3a7a2e' },
      { type: 'bench', x: 3, z: 5, width: 2, color: '#8B6914' },
      { type: 'bush', x: -6, z: -3, color: '#2d6a1e' },
      { type: 'bush', x: 7, z: -1, color: '#3a8a2e' },
    ],
    npcs: [
      {
        id: 'golden_retriever',
        name: 'Buddy',
        color: '#DAA520',
        accentColor: '#FFD700',
        x: 2,
        z: -3,
        dialogue: [
          'Woof! Welcome to the park!',
          'Home is where the fence is. Which fence?',
          'I used to live near the big oak tree!',
          'Follow the scent posts — they lead somewhere!',
        ],
      },
      {
        id: 'dog_walker',
        name: 'Sarah',
        color: '#5a7a9a',
        accentColor: '#4a9eff',
        x: -3,
        z: 4,
        dialogue: [
          'Hi there, sweetie! Are you lost?',
          'Have you seen a husky around here?',
          'The shelter is this way! *points*',
        ],
      },
    ],
    features: [
      { type: 'water_bowl', x: 6, z: 3, id: 'water_bowl', label: '💧 Water Bowl' },
      { type: 'fire_hydrant', x: -5, z: -2, id: 'fire_hydrant', label: '🚒 Fire Hydrant' },
      { type: 'scent_post', x: 0, z: 7, id: 'scent_post', label: '🐾 Scent Post' },
      { type: 'treasure', x: -7, z: 5, id: 'treasure_1', label: '✨ Scent Clue' },
    ],
    hint: 'A big dog says "Home is where the fence is." Fences are everywhere... but which fence?',
  },
  apartment: {
    id: 'apartment',
    name: '🏠 Random Apartment',
    desc: 'You found the door open. Inside: smells, sounds, and a TV that barks back.',
    type: 'fp',
    rooms: [
      { id: 'apt_entrance', name: 'Entryway', w: 120, h: 80, d: 150, color: '#8a7a6a', exits: ['apt_living', 'apt_kitchen'], isEntrance: true, entranceZone: 'suburban_streets' },
      { id: 'apt_living', name: 'Living Room', w: 200, h: 100, d: 180, color: '#7a6a5a', exits: ['apt_entrance', 'apt_bedroom'], features: [{type:'tv', x:100, y:50, w:60, h:40, label:'📺 TV (barks back)'}] },
      { id: 'apt_kitchen', name: 'Kitchen', w: 150, h: 90, d: 120, color: '#9a8a7a', exits: ['apt_entrance'], features: [{type:'food', x:75, y:45, w:40, h:30, label:'🍖 Food', item:'treat'}] },
      { id: 'apt_bedroom', name: 'Bedroom', w: 160, h: 90, d: 140, color: '#6a5a7a', exits: ['apt_living'], features: [{type:'hint', x:80, y:45, w:50, h:30, label:'🧸 Toy', item:'toy'}] }
    ],
    music: 'apartment',
    hint: 'Under the bed: a red ball. You remember throwing this. Someone threw this. For YOU.'
  },
  shelter: {
    id: 'shelter',
    name: '🏥 Animal Shelter',
    desc: 'Cages, sounds, and hope. Maybe some dogs here know the way home.',
    type: 'fp',
    rooms: [
      { id: 'shelter_lobby', name: 'Lobby', w: 200, h: 100, d: 150, color: '#8a8a9a', exits: ['shelter_kennels', 'shelter_office', 'shelter_exit'] },
      { id: 'shelter_exit', name: 'Exit Door', w: 80, h: 60, d: 80, color: '#6a6a7a', exits: ['shelter_lobby', 'shelter_to_neighborhood'] },
      { id: 'shelter_to_neighborhood', name: 'Side Gate', w: 60, h: 50, d: 60, color: '#5a5a6a', exits: ['shelter_lobby'] },
      { id: 'shelter_kennels', name: 'Kennels', w: 300, h: 120, d: 200, color: '#7a7a8a', exits: ['shelter_lobby'], features: [{type:'dog_friend', x:150, y:60, w:50, h:40, label:'🐕 New Friend', item:'friend'}] },
      { id: 'shelter_office', name: 'Office', w: 120, h: 80, d: 100, color: '#6a6a7a', exits: ['shelter_lobby'], features: [{type:'hint', x:60, y:40, w:40, h:30, label:'📋 Poster', item:'map_fragment'}] }
    ],
    music: 'shelter',
    hint: 'A poster shows a lost dog. It looks... familiar. But it could be anyone.'
  },
  neighborhood: {
    id: 'neighborhood',
    name: '🏡 The Neighborhood',
    desc: 'The streets feel familiar. You\'re close. You can feel it.',
    type: 'fp',
    rooms: [
      { id: 'neighborhood_entrance', name: 'Side Gate', w: 80, h: 60, d: 80, color: '#5a5a5a', exits: ['neighborhood_start'], isEntrance: true, entranceZone: 'shelter' },
      { id: 'neighborhood_start', name: 'Street Corner', w: 250, h: 120, d: 200, color: '#5a8a5a', exits: ['neighborhood_main', 'neighborhood_park', 'neighborhood_entrance'] },
      { id: 'neighborhood_main', name: 'Main Street', w: 350, h: 140, d: 300, color: '#6a6a6a', exits: ['neighborhood_start', 'neighborhood_home'], features: [{type:'person', x:175, y:70, w:40, h:60, label:'👤 "Have you seen a dog like him?"'}] },
      { id: 'neighborhood_park', name: 'Local Park', w: 200, h: 100, d: 180, color: '#4a7a3a', exits: ['neighborhood_start'], features: [{type:'hint', x:100, y:50, w:60, h:30, label:'🌳 Old Tree', item:'tree_clue'}] },
      { id: 'neighborhood_home', name: 'The House', w: 180, h: 100, d: 150, color: '#8a7a5a', exits: ['neighborhood_main'], isHome: true, features: [{type:'home', x:90, y:50, w:60, h:60, label:'🏠 Home'}] }
    ],
    music: 'home',
    hint: 'The gate. It\'s the same gate. You remember this one. This is it.'
  }
};

// ===== ITEMS =====
export const ITEMS = {
  bone: { name: '🦴 Bone', desc: 'A good bone. Smells familiar.' },
  treat: { name: '🍖 Treat', desc: 'Delicious! Restores happiness.' },
  toy: { name: '🧸 Toy', desc: 'A red ball. You remember this.' },
  key: { name: '🗝️ Key', desc: 'A small metal key.' },
  map_fragment: { name: '📋 Map Fragment', desc: 'Part of a map. Shows a street.' },
  tree_clue: { name: '🌳 Tree Clue', desc: 'A tree you remember. Marked with a scratch.' },
  friend: { name: '🐕 Friend', desc: 'A new companion!' },
  food: { name: '🍎 Food', desc: 'A snack for the road.' }
};

// ===== THREATS =====
export const THREATS: Record<string, Threat> = {
  traffic: {
    name: 'Traffic',
    icon: '🚗',
    type: 'timing',
    description: 'Cars are zooming by! Time your crossing!',
    solve: 'Press SPACE when the gap is right',
    mangaText: 'SCREEEECH!',
    mangaType: 'near-miss'
  },
  cat: {
    name: 'Mean Cat',
    icon: '🐱',
    type: 'combat',
    description: 'A hissing cat blocks the path!',
    solve: 'Press SPACE in rhythm to scare it off',
    mangaText: 'SCRATCH!',
    mangaType: 'fight'
  },
  bully: {
    name: 'Bully Dog',
    icon: '🐕‍🦺',
    type: 'combat',
    description: 'A tough-looking dog growls at you!',
    solve: 'Press SPACE in rhythm to intimidate it',
    mangaText: 'GRRR!',
    mangaType: 'fight'
  },
  storm: {
    name: 'Thunderstorm',
    icon: '⛈️',
    type: 'comfort',
    description: 'Thunder roars! Find shelter or comfort yourself.',
    solve: 'Find shelter quickly or use a comfort item',
    mangaText: 'BOOM!',
    mangaType: 'scare'
  },
  vacuum: {
    name: 'Vacuum Monster',
    icon: '🤖',
    type: 'sneak',
    description: 'The dreaded vacuum cleaner! Hide!',
    solve: 'Stay still when it approaches, move when safe',
    mangaText: 'VRRRRR!',
    mangaType: 'scare'
  }
};
