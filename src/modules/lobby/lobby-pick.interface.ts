export interface LobbyPick {
  // The pick information.
  pick: {
    // Picked player DiscordID.
    player: string;

    // The role they've been picked as.
    role: string;
  };

  // Discord ID of the captain that sent this pick request.
  captain: string;
}
