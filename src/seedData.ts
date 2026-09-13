import { CharacterCard, EpisodeBoard, StringConnection, StickyNote } from './types';

export const EPISODE_1_DRIVE_FILE_ID = '1QfcDCpuVPL8bg36CcwhrCa0df-Y0aoFL';
export const EPISODE_1_EMBED_URL = `https://drive.google.com/file/d/${EPISODE_1_DRIVE_FILE_ID}/preview`;
export const EPISODE_1_VIEW_URL = `https://drive.google.com/file/d/${EPISODE_1_DRIVE_FILE_ID}/view`;
export const EPISODE_1_RAW_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1QfcDCpuVPL8bg36CcwhrCa0df-Y0aoFL&export=download&authuser=0&confirm=t&uuid=72875448-b677-4fc8-bb6f-0f9df7bafab2&at=AMrWOn1fiyjbazbKsqibfYU_saeZ:1789010242243';
export const EPISODE_1_VIDEO_URL = EPISODE_1_EMBED_URL;

export const EPISODE_2_DRIVE_FILE_ID = '1QMu-g9mIRyCO2EZdY2RjHHX5VuOwvIm9';
export const EPISODE_2_EMBED_URL = `https://drive.google.com/file/d/${EPISODE_2_DRIVE_FILE_ID}/preview`;
export const EPISODE_2_VIEW_URL = `https://drive.google.com/file/d/${EPISODE_2_DRIVE_FILE_ID}/view`;
export const EPISODE_2_RAW_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1QMu-g9mIRyCO2EZdY2RjHHX5VuOwvIm9&export=download&authuser=0&confirm=t&uuid=f5178338-18cb-4ae5-a13a-06129f8d1611&at=AMrWOn0dskNjZ-x_ETB63BKKhgPB:1789011217527';
export const EPISODE_2_VIDEO_URL = EPISODE_2_EMBED_URL;

export const EPISODE_3_DRIVE_FILE_ID = '1G3dPJzNXMzWrF62gqb9dRTbc4NJFj5qp';
export const EPISODE_3_EMBED_URL = `https://drive.google.com/file/d/${EPISODE_3_DRIVE_FILE_ID}/preview`;
export const EPISODE_3_VIEW_URL = `https://drive.google.com/file/d/${EPISODE_3_DRIVE_FILE_ID}/view`;
export const EPISODE_3_RAW_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1G3dPJzNXMzWrF62gqb9dRTbc4NJFj5qp&export=download&authuser=0&confirm=t&uuid=fed93477-3770-4616-a872-87848a80e1ac&at=AMrWOn2xhXWnqq0qzvjbmxwqtfzl:1789018377094';
export const EPISODE_3_VIDEO_URL = EPISODE_3_EMBED_URL;

export const EPISODE_4_DRIVE_FILE_ID = '1JtJY5mpAy5XbJ6VqYnWaqTrlTKmfAHkS';
export const EPISODE_4_EMBED_URL = `https://drive.google.com/file/d/${EPISODE_4_DRIVE_FILE_ID}/preview`;
export const EPISODE_4_VIEW_URL = `https://drive.google.com/file/d/${EPISODE_4_DRIVE_FILE_ID}/view`;
export const EPISODE_4_RAW_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1JtJY5mpAy5XbJ6VqYnWaqTrlTKmfAHkS&export=download&authuser=0&confirm=t&uuid=605d90ff-76d7-4fc1-a2a4-4cc845f1b1f6&at=AMrWOn0eXipRWTC-otTdV_g-DUPs:1789018817305';
export const EPISODE_4_VIDEO_URL = EPISODE_4_EMBED_URL;

export const EPISODE_5_DRIVE_FILE_ID = '1WvjHW6oj7_O8Nj3JP_SwU2djfXB22SJv';
export const EPISODE_5_EMBED_URL = `https://drive.google.com/file/d/${EPISODE_5_DRIVE_FILE_ID}/preview`;
export const EPISODE_5_VIEW_URL = `https://drive.google.com/file/d/${EPISODE_5_DRIVE_FILE_ID}/view`;
export const EPISODE_5_RAW_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1WvjHW6oj7_O8Nj3JP_SwU2djfXB22SJv&export=download&authuser=0&confirm=t&uuid=156b6996-7ec1-4dbc-a9ac-774bdd02cdf6&at=AMrWOn1fFY7dGag1ZA9NqhrmJzSg:1789019058091';
export const EPISODE_5_VIDEO_URL = EPISODE_5_EMBED_URL;

export const EPISODE_6_DRIVE_FILE_ID = '1FFymzNoG4hEJ2RwRU6LyYUF5b3y6HCeR';
export const EPISODE_6_EMBED_URL = `https://drive.google.com/file/d/${EPISODE_6_DRIVE_FILE_ID}/preview`;
export const EPISODE_6_VIEW_URL = `https://drive.google.com/file/d/${EPISODE_6_DRIVE_FILE_ID}/view`;
export const EPISODE_6_RAW_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1FFymzNoG4hEJ2RwRU6LyYUF5b3y6HCeR&export=download&authuser=0&confirm=t&uuid=19ab8942-a937-4bdd-a2c9-3d0cc9df77fb&at=AMrWOn11E__8jiMBfEHAmf8AuoGG:1789262529700';
export const EPISODE_6_VIDEO_URL = EPISODE_6_EMBED_URL;

export interface EpisodeVideoData {
  episodeNumber: number;
  title: string;
  badge: string;
  driveFileId: string;
  embedUrl: string;
  viewUrl: string;
  rawDownloadUrl: string;
  durationSeconds: number;
  description: string;
}

export const EPISODE_STREAMS: Record<number, EpisodeVideoData> = {
  1: {
    episodeNumber: 1,
    title: 'Episode 1: Pilot (Northwest Passage)',
    badge: 'EPISODE 1: PILOT',
    driveFileId: EPISODE_1_DRIVE_FILE_ID,
    embedUrl: EPISODE_1_EMBED_URL,
    viewUrl: EPISODE_1_VIEW_URL,
    rawDownloadUrl: EPISODE_1_RAW_DOWNLOAD_URL,
    durationSeconds: 5640,
    description: 'The discovery of Laura Palmer wrapped in plastic by the Packard Sawmill shore. Official investigation opened.'
  },
  2: {
    episodeNumber: 2,
    title: 'Episode 2: Traces to Nowhere',
    badge: 'EPISODE 2: TRACES TO NOWHERE',
    driveFileId: EPISODE_2_DRIVE_FILE_ID,
    embedUrl: EPISODE_2_EMBED_URL,
    viewUrl: EPISODE_2_VIEW_URL,
    rawDownloadUrl: EPISODE_2_RAW_DOWNLOAD_URL,
    durationSeconds: 2880,
    description: 'Agent Cooper interrogates James Hurley; visits to Horne department store and Leo Johnson’s residence. Cryptic warnings from the Log Lady.'
  },
  3: {
    episodeNumber: 3,
    title: 'Episode 3: Zen, or the Skill to Catch a Killer',
    badge: 'EPISODE 3: ZEN, OR THE SKILL TO CATCH A KILLER',
    driveFileId: EPISODE_3_DRIVE_FILE_ID,
    embedUrl: EPISODE_3_EMBED_URL,
    viewUrl: EPISODE_3_VIEW_URL,
    rawDownloadUrl: EPISODE_3_RAW_DOWNLOAD_URL,
    durationSeconds: 2940,
    description: 'Agent Cooper demonstrates his deductive Tibetan rock-throwing technique in the woods. Cooper later experiences his iconic dream in the Red Room with the Man from Another Place and Laura Palmer.'
  },
  4: {
    episodeNumber: 4,
    title: 'Episode 4: Rest in Pain',
    badge: 'EPISODE 4: REST IN PAIN',
    driveFileId: EPISODE_4_DRIVE_FILE_ID,
    embedUrl: EPISODE_4_EMBED_URL,
    viewUrl: EPISODE_4_VIEW_URL,
    rawDownloadUrl: EPISODE_4_RAW_DOWNLOAD_URL,
    durationSeconds: 2940,
    description: 'The town gathers for Laura Palmer’s heartbreaking funeral, erupting into family heartbreak and chaos at the cemetery. Cooper learns of the Bookhouse Boys secret society.'
  },
  5: {
    episodeNumber: 5,
    title: 'Episode 5: The One-Armed Man',
    badge: 'EPISODE 5: THE ONE-ARMED MAN',
    driveFileId: EPISODE_5_DRIVE_FILE_ID,
    embedUrl: EPISODE_5_EMBED_URL,
    viewUrl: EPISODE_5_VIEW_URL,
    rawDownloadUrl: EPISODE_5_RAW_DOWNLOAD_URL,
    durationSeconds: 2940,
    description: 'Cooper and Truman question the One-Armed Man (Phillip Gerard) and track veterinarian records for a mysterious bird. Audrey Horne goes undercover at One Eyed Jacks.'
  },
  6: {
    episodeNumber: 6,
    title: "Episode 6: Cooper's Dreams",
    badge: "EPISODE 6: COOPER'S DREAMS",
    driveFileId: EPISODE_6_DRIVE_FILE_ID,
    embedUrl: EPISODE_6_EMBED_URL,
    viewUrl: EPISODE_6_VIEW_URL,
    rawDownloadUrl: EPISODE_6_RAW_DOWNLOAD_URL,
    durationSeconds: 2880,
    description: "Agent Cooper, Sheriff Truman, Deputy Hawk, and Doc Hayward search Jacques Renault's cabin in the woods, finding Waldo the Mynah bird. Audrey Horne begins her undercover work at One Eyed Jacks."
  }
};

export const INITIAL_PILOT_BOARD: EpisodeBoard = {
  id: 'episode-1-pilot',
  title: 'Episode 1: Pilot (Northwest Passage)',
  episode_number: 1,
  created_at: new Date('2026-09-01T08:00:00Z').toISOString(),
  updated_at: new Date('2026-09-01T10:30:00Z').toISOString(),
  description: 'The discovery of Laura Palmer wrapped in plastic by the Packard Sawmill shore. Official investigation opened.'
};

export const INITIAL_EPISODE_2_BOARD: EpisodeBoard = {
  id: 'episode-2-traces-to-nowhere',
  title: 'Episode 2: Traces to Nowhere',
  episode_number: 2,
  created_at: new Date('2026-09-02T08:00:00Z').toISOString(),
  updated_at: new Date('2026-09-02T10:00:00Z').toISOString(),
  description: 'Agent Cooper questions James Hurley; visits to the Horne department store and Leo Johnson’s house. The Log Lady shares cryptic warnings.'
};

export const INITIAL_EPISODE_3_BOARD: EpisodeBoard = {
  id: 'episode-3-zen-skill',
  title: 'Episode 3: Zen, or the Skill to Catch a Killer',
  episode_number: 3,
  created_at: new Date('2026-09-03T08:00:00Z').toISOString(),
  updated_at: new Date('2026-09-03T10:00:00Z').toISOString(),
  description: 'Agent Cooper demonstrates his deductive Tibetan rock-throwing technique in the woods. Cooper later experiences his iconic dream in the Red Room with the Man from Another Place and Laura Palmer.'
};

export const INITIAL_EPISODE_4_BOARD: EpisodeBoard = {
  id: 'episode-4-rest-in-pain',
  title: 'Episode 4: Rest in Pain',
  episode_number: 4,
  created_at: new Date('2026-09-04T08:00:00Z').toISOString(),
  updated_at: new Date('2026-09-04T10:00:00Z').toISOString(),
  description: 'The town gathers for Laura Palmer’s heartbreaking funeral, erupting into family heartbreak and chaos at the cemetery. Cooper learns of the Bookhouse Boys secret society.'
};

export const INITIAL_EPISODE_5_BOARD: EpisodeBoard = {
  id: 'episode-5-the-one-armed-man',
  title: 'Episode 5: The One-Armed Man',
  episode_number: 5,
  created_at: new Date('2026-09-05T08:00:00Z').toISOString(),
  updated_at: new Date('2026-09-05T10:00:00Z').toISOString(),
  description: 'Cooper and Truman question the One-Armed Man (Phillip Gerard) and track veterinarian records for a mysterious bird. Audrey Horne goes undercover at One Eyed Jacks.'
};

export const INITIAL_EPISODE_6_BOARD: EpisodeBoard = {
  id: 'episode-6-coopers-dreams',
  title: "Episode 6: Cooper's Dreams",
  episode_number: 6,
  created_at: new Date('2026-09-06T08:00:00Z').toISOString(),
  updated_at: new Date('2026-09-06T10:00:00Z').toISOString(),
  description: "Agent Cooper, Sheriff Truman, Deputy Hawk, and Doc Hayward search Jacques Renault's cabin in the woods, finding Waldo the Mynah bird. Audrey Horne begins her undercover work at One Eyed Jacks."
};

// Start with no cards on the board at the start as requested
export const INITIAL_PILOT_CHARACTERS: CharacterCard[] = [];
export const INITIAL_PILOT_STRINGS: StringConnection[] = [];
export const INITIAL_PILOT_STICKIES: StickyNote[] = [];

export interface CharacterPreset {
  id: string;
  name: string;
  category: 'Law Enforcement & Officials' | 'High School & Youth' | 'Town Residents & Businesses';
  role: string;
  defaultStatus?: 'Unknown' | 'Suspect' | 'Victim' | 'Cleared';
}

export const TWIN_PEAKS_ROSTER_PRESETS: CharacterPreset[] = [
  // Law Enforcement & Officials
  {
    id: 'dale-cooper',
    name: 'Special Agent Dale Cooper',
    category: 'Law Enforcement & Officials',
    role: 'FBI agent dispatched to Twin Peaks to lead homicide investigation',
    defaultStatus: 'Cleared',
  },
  {
    id: 'harry-truman',
    name: 'Sheriff Harry S. Truman',
    category: 'Law Enforcement & Officials',
    role: 'Twin Peaks sheriff cooperating with Agent Cooper',
    defaultStatus: 'Cleared',
  },
  {
    id: 'andy-brennan',
    name: 'Deputy Andy Brennan',
    category: 'Law Enforcement & Officials',
    role: 'Sensitive deputy at Twin Peaks Sheriff\'s Department',
    defaultStatus: 'Cleared',
  },
  {
    id: 'hawk-hill',
    name: 'Deputy Tommy "Hawk" Hill',
    category: 'Law Enforcement & Officials',
    role: 'Skilled tracker and deputy at Sheriff\'s Department',
    defaultStatus: 'Cleared',
  },
  {
    id: 'lucy-moran',
    name: 'Lucy Moran',
    category: 'Law Enforcement & Officials',
    role: 'Receptionist and dispatcher at the Sheriff\'s Station',
    defaultStatus: 'Cleared',
  },
  {
    id: 'dr-hayward',
    name: 'Dr. Will Hayward',
    category: 'Law Enforcement & Officials',
    role: 'Town physician and coroner assisting with medical examinations',
    defaultStatus: 'Cleared',
  },
  {
    id: 'albert-rosenfield',
    name: 'Albert Rosenfield',
    category: 'Law Enforcement & Officials',
    role: 'Abrasive FBI forensic pathologist and ballistics expert',
    defaultStatus: 'Cleared',
  },

  // High School & Youth
  {
    id: 'laura-palmer',
    name: 'Laura Palmer',
    category: 'High School & Youth',
    role: 'High school homecoming queen found dead wrapped in plastic by the riverbank',
    defaultStatus: 'Victim',
  },
  {
    id: 'donna-hayward',
    name: 'Donna Hayward',
    category: 'High School & Youth',
    role: 'Laura\'s best friend and high school classmate',
    defaultStatus: 'Unknown',
  },
  {
    id: 'james-hurley',
    name: 'James Hurley',
    category: 'High School & Youth',
    role: 'Quiet high school student with secret ties to Laura, rides a motorcycle',
    defaultStatus: 'Unknown',
  },
  {
    id: 'bobby-briggs',
    name: 'Bobby Briggs',
    category: 'High School & Youth',
    role: 'High school football captain and Laura\'s official boyfriend',
    defaultStatus: 'Suspect',
  },
  {
    id: 'audrey-horne',
    name: 'Audrey Horne',
    category: 'High School & Youth',
    role: 'Benjamin Horne\'s rebellious daughter, attends high school',
    defaultStatus: 'Unknown',
  },
  {
    id: 'mike-nelson',
    name: 'Mike Nelson',
    category: 'High School & Youth',
    role: 'High school wrestler and Bobby Briggs\' best friend',
    defaultStatus: 'Suspect',
  },
  {
    id: 'ronette-pulaski',
    name: 'Ronette Pulaski',
    category: 'High School & Youth',
    role: 'High school student and department store clerk who crossed state line in shock',
    defaultStatus: 'Victim',
  },

  // Town Residents & Businesses
  {
    id: 'shelly-johnson',
    name: 'Shelly Johnson',
    category: 'Town Residents & Businesses',
    role: 'Waitress at Double R Diner, married to Leo Johnson',
    defaultStatus: 'Unknown',
  },
  {
    id: 'leo-johnson',
    name: 'Leo Johnson',
    category: 'Town Residents & Businesses',
    role: 'Erratic long-haul trucker with violent temper, married to Shelly',
    defaultStatus: 'Suspect',
  },
  {
    id: 'josie-packard',
    name: 'Josie Packard',
    category: 'Town Residents & Businesses',
    role: 'Widow of Andrew Packard, owner of Packard Sawmill',
    defaultStatus: 'Unknown',
  },
  {
    id: 'pete-martell',
    name: 'Pete Martell',
    category: 'Town Residents & Businesses',
    role: 'Sawmill worker and fisherman who discovered the body',
    defaultStatus: 'Cleared',
  },
  {
    id: 'catherine-martell',
    name: 'Catherine Martell',
    category: 'Town Residents & Businesses',
    role: 'Pete\'s wife, manages Packard Sawmill with sharp business tactics',
    defaultStatus: 'Unknown',
  },
  {
    id: 'benjamin-horne',
    name: 'Benjamin Horne',
    category: 'Town Residents & Businesses',
    role: 'Prominent businessman, owner of the Great Northern Hotel & Horne\'s Dept Store',
    defaultStatus: 'Unknown',
  },
  {
    id: 'leland-palmer',
    name: 'Leland Palmer',
    category: 'Town Residents & Businesses',
    role: 'Laura\'s grief-stricken father, local attorney for Benjamin Horne',
    defaultStatus: 'Unknown',
  },
  {
    id: 'sarah-palmer',
    name: 'Sarah Palmer',
    category: 'Town Residents & Businesses',
    role: 'Laura\'s mother, experiences psychic visions and distress',
    defaultStatus: 'Unknown',
  },
  {
    id: 'big-ed-hurley',
    name: 'Big Ed Hurley',
    category: 'Town Residents & Businesses',
    role: 'Runs Big Ed\'s Gas Farm, James\'s uncle, secretly loves Norma',
    defaultStatus: 'Unknown',
  },
  {
    id: 'nadine-hurley',
    name: 'Nadine Hurley',
    category: 'Town Residents & Businesses',
    role: 'Ed\'s wife with patch on eye, obsessed with silent drape runners',
    defaultStatus: 'Unknown',
  },
  {
    id: 'norma-jennings',
    name: 'Norma Jennings',
    category: 'Town Residents & Businesses',
    role: 'Owner of the Double R Diner, manages Meals on Wheels',
    defaultStatus: 'Unknown',
  },
  {
    id: 'hank-jennings',
    name: 'Hank Jennings',
    category: 'Town Residents & Businesses',
    role: 'Norma\'s husband, serving time at state penitentiary up for parole',
    defaultStatus: 'Suspect',
  },
  {
    id: 'dr-jacoby',
    name: 'Dr. Lawrence Jacoby',
    category: 'Town Residents & Businesses',
    role: 'Eccentric psychiatrist who treated Laura in secret',
    defaultStatus: 'Suspect',
  },
  {
    id: 'major-briggs',
    name: 'Major Garland Briggs',
    category: 'Town Residents & Businesses',
    role: 'US Air Force officer working on classified deep space listening project',
    defaultStatus: 'Cleared',
  },
  {
    id: 'log-lady',
    name: 'Margaret "the Log Lady" Lanterman',
    category: 'Town Residents & Businesses',
    role: 'Town resident who carries a ponderosa pine log and shares cryptic warnings',
    defaultStatus: 'Unknown',
  },
  {
    id: 'jacques-renault',
    name: 'Jacques Renault',
    category: 'Town Residents & Businesses',
    role: 'French-Canadian bartender at the Roadhouse and casino dealer at One-Eyed Jacks',
    defaultStatus: 'Suspect',
  },
];

