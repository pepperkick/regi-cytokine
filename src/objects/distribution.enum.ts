export enum DistributionType {
  RANDOM = 'RANDOM', // Players queue by selecting a role and get randomly assigned to a team
  CAPTAIN_BASED = 'CAPTAIN_BASED', // Captains pick players to their teams and also define their classes (PugChamp Style)
  TEAM_ROLE_BASED = 'TEAM_ROLE_BASED', // Can pick a class and team (TF2Center Style)
}
