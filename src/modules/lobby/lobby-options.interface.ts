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

  // The game this lobby is for
  game: Game;

  // The region this lobby will take place in
  region: string;

  // The format of the lobby
  format?: LobbyFormat;

  // Options for match
  matchOptions: {
    players: Player[];
    preferences?: {
      requiredPlayers?: number;
    };
  };
}
