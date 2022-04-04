import { Player } from '../../objects/match-player.interface';
import { FormatRequirement } from '../../objects/requirement.interface';
import { DistributionType } from '../../objects/distribution.enum';
import { Game } from 'src/objects/game.enum';
import { LobbyFormat } from 'src/objects/lobby-format.interface';

export interface LobbyOptions {
  // Distribution logic type to follow for this lobby
  distribution: DistributionType;

  // Callback URL for status updates.
  callbackUrl: string;

  // List of players in this lobby.
  queuedPlayers: Player[];

  // Role requirements to be filled to start the match
  requirements: FormatRequirement[];

  // The Discord ID of the user creating this lobby
  userId: string;

  // The format of the lobby
  format?: LobbyFormat;

  // Data for lobby
  data?: {
    expiryTime: number;
  };

  // Options for match
  matchOptions: {
    players: Player[];

    // The game this lobby is for
    game: Game;

    // The region this lobby will take place in
    region: string;

    // The map to be played in the lobby
    map: string;

    // Maximum players required for the lobby to start
    requiredPlayers: number;

    // Callback URL for status updates.
    callbackUrl?: string;

    preference?: {
      requiredPlayers?: number;
      createLighthouseServer?: boolean;
      afkCheck?: boolean;
      valveSdr?: boolean;
      gameConfig?: string;
    };
  };
}
