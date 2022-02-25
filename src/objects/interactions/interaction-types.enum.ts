export enum InteractionType {
  // Queue is only present on a RANDOM distribution lobby.
  QUEUE = 'queue',
  // Present in all types of lobbies
  UNQUEUE = 'unqueue',
  // TODO: Add support for other Lobby Distribution Methods
  TEAM_ROLE_SELECT = 'team-role-queue',

  // - Close Lobby
  LOBBY_CLOSE = 'lobby-close-select',
}
