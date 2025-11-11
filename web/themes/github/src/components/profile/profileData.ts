/* disabled for now : 11.11.2025
// Profile data types
export interface ProfileData {
  type: 'individual' | 'organization';
  name: string;
  username: string;
  avatarUrl: string;
  bio?: string;
  location?: string;
  website?: string;
  company?: string;
  // Social platform usernames
  githubUsername?: string;
  xUsername?: string;
  gitlabUsername?: string;
  bitbucketUsername?: string;
  discordUsername?: string;
  devtoUsername?: string;
  hashnodeUsername?: string;
  mediumUsername?: string;
  substackUsername?: string;
}

// Mock profile data - hardcoded for demo
export const profileData: ProfileData = {
  type: 'individual',
  name: 'Louis',
  username: 'Fantasim',
  avatarUrl: 'https://avatars.githubusercontent.com/u/9706112', // Using GitHub's avatar as placeholder
  bio: 'Do your work, then step back from the equation. The only path to serenity.',
  location: 'Amsterdam, Netherlands',
  website: 'https://backthynk.com',
  company: 'Insanity Flyff',
  githubUsername: 'Fantasim',
  xUsername: 'motivtosuccess',
  // gitlabUsername: 'louisanderson',
  // bitbucketUsername: 'louisanderson',
  discordUsername: 'tafan2970',
  // devtoUsername: 'louisanderson',
  // hashnodeUsername: 'louisanderson',
  // mediumUsername: 'louisanderson',
  // substackUsername: 'louisanderson',
};

// Alternative organization profile data
export const orgProfileData: ProfileData = {
  type: 'organization',
  name: 'Backthynk',
  username: 'backthynk',
  avatarUrl: 'https://github.com/github.png',
  bio: 'Building the future of knowledge management',
  location: 'San Francisco, CA',
  website: 'https://backthynk.com',
  githubUsername: 'backthynk',
};
*/