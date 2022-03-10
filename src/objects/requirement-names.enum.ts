export enum RequirementName {
  // Generic roles
  PLAYER = 'player',
  CREATOR = 'creator',
  ACTIVE = 'active',

  // Roles for:
  //  - Team-Role Based Distribution
  // TF2Center Lobby Type (Player picks their team and class)
  TEAM_A = 'team_a',
  TEAM_B = 'team_b',
  RED_SCOUT = 'red-scout',
  BLU_SCOUT = 'blu-scout',
  RED_SOLDIER = 'red-soldier',
  BLU_SOLDIER = 'blu-soldier',
  RED_PYRO = 'red-pyro',
  BLU_PYRO = 'blu-pyro',
  RED_DEMOMAN = 'red-demoman',
  BLU_DEMOMAN = 'blu-demoman',
  RED_HEAVY = 'red-heavy',
  BLU_HEAVY = 'blu-heavy',
  RED_ENGINEER = 'red-engineer',
  BLU_ENGINEER = 'blu-engineer',
  RED_MEDIC = 'red-medic',
  BLU_MEDIC = 'blu-medic',
  RED_SNIPER = 'red-sniper',
  BLU_SNIPER = 'blu-sniper',
  RED_SPY = 'red-spy',
  BLU_SPY = 'blu-spy',

  // Roles for:
  //  - Captain Based Distribution
  //  - Random Distribution (excludes CAPTAIN)
  // TF2Pickup/PugChamp Lobby Type (Players can select their role, but not the team they desire to be in)
  CAPTAIN_A = 'captain-a',
  CAPTAIN_B = 'captain-b',
  SCOUT = 'scout',
  SOLDIER = 'soldier',
  PYRO = 'pyro',
  DEMOMAN = 'demoman',
  HEAVY = 'heavy',
  ENGINEER = 'engineer',
  MEDIC = 'medic',
  SNIPER = 'sniper',
  SPY = 'spy',
}
