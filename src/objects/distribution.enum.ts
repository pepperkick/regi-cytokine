export enum DistributionType {
  RANDOM = 'RANDOM', // Players queue by selecting a role and get randomly assigned to a team
  CAPTAIN_ROLE_PICK = 'CAPTAIN_ROLE_PICK', // Captains pick players to their teams and also define their classes (PugChamp Style)
  CAPTAIN_NO_ROLE_PICK = 'CAPTAIN_NO_ROLE_PICK', // Captains pick players to their teams, but not define their classes
  TEAM_ROLE_BASED = 'TEAM_ROLE_BASED', // Can pick a class and team (TF2Center Style)
}
