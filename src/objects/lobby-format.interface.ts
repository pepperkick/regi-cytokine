import { FormatRequirement } from './requirement.interface';
import { DistributionType } from './distribution.enum';

/*
 * Represents a format in a lobby.
 * Allows administrators to add custom formats with custom requirements and playability to the system.
 *
 */
export class LobbyFormat {
  // Name of the format to be disputed (Ex: "6vs6", "2v2", "3v3")
  name: string;

  // Type of lobby (Ex: "captain-based", "normal", ...) TODO: Code in types
  distribution?: DistributionType;

  // The game this format is compatible with.
  // TODO: Add other games (since it's a single game for now, later could be "tf2" | "csgo" | ... )
  game: 'tf2-comp';

  // Requirements list for this type of format (determining maximum classes, etcetera)
  requirements: FormatRequirement[];

  // The maximum amount of players (required players) to start a game with this format
  maxPlayers: number;

  // Types of maps available in this format (Ex: cp_ for 5CP 6s maps, pl_ for Highlander, etcetera)
  mapTypes: string[];
}
