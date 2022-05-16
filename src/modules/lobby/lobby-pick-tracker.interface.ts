export interface LobbyPickTracker {
  // The position of picks we're in.
  position: number;

  // List of Picking order.
  // Contains the Discord IDs of the captains
  picks: string[];
}
