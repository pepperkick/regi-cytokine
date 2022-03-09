import { FormatRequirement } from './requirement.interface';
import { DistributionType } from './distribution.enum';
import { Game } from './game.enum';

/*
 * Represents a format in a lobby.
 * Allows administrators to add custom formats with custom requirements and playability to the system.
 *
 */

interface FormatMapType {
  name: string;
  config: string;
  expires?: number;
}

interface DistributionMethod {
  type: DistributionType;
  requirements: FormatRequirement[];
}

export class LobbyFormat {
  // Name of the format to be disputed (Ex: "6vs6", "2v2", "3v3")
  name: string;

  // If true, does not list this format in the command parameters, but still interpreted if passed.
  hidden: boolean;

  // Type of lobby (Ex: "captain-based", "normal", ...)
  distribution: DistributionMethod[];

  // The game this format is compatible with.
  game: Game;

  // The maximum amount of players (required players) to start a game with this format
  maxPlayers: number;

  // Types of maps available in this format (Ex: cp for 5CP 6s maps, pl for Highlander, etcetera)
  mapTypes: FormatMapType[];

  // The pool of maps available this format has.
  maps: string[];
}
