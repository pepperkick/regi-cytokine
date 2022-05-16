export enum InteractionType {
  // Queue is only present on a RANDOM distribution lobby.
  // DEPRECATED
  QUEUE = 'queue',
  // Present in all types of lobbies
  UNQUEUE = 'unqueue',
  // Randomised Role only selection
  ROLE_SELECT = 'role-queue',
  // Team-Role Based Distribution Queueing SelectMenu
  TEAM_ROLE_SELECT = 'team-role-queue',
  // Captain Based Distribution
  ROLE_SELECT_CAPTAINS = 'role-queue-captain',
  CAPTAIN_PICK = 'captain-pick',

  // AFK Check
  AFK_CHECK = 'afk-check',

  // Substitute Player
  PLAYER_SUB = 'player-substitute',

  // Close Lobby
  LOBBY_CLOSE = 'lobby-close-select',
}
