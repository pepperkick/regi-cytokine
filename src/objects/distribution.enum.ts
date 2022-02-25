export enum DistributionType {
  RANDOM = 'RANDOM', // Players queue and get randomly assigned to a team with no class enforcement
  CAPTAIN_ROLE_PICK = 'CAPTAIN_ROLE_PICK', // Captains pick players to their teams and also define their classes (PugChamp Style)
  CAPTAIN_NO_ROLE_PICK = 'CAPTAIN_NO_ROLE_PICK', // Captains pick players to their teams, but not define their classes
  TEAM_ROLE_BASED = 'TEAM_ROLE_BASED', // Can pick a class and team (TF2Center Style)
  ROLE_BASED = 'ROLE_BASED', // Can pick a class, but not a team (TF2Pickup Style)
}
