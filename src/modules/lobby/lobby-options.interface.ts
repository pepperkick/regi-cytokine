import { Player } from '../../objects/match-player.interface';
import { FormatRequirement } from '../../objects/requirement.interface';
import { DistributionType } from '../../objects/distribution.enum';

export interface LobbyOptions {
  // Distribution logic type to follow for this lobby
  distribution: DistributionType;

  // Callback URL for status updates.
  callbackUrl: string;

  // List of players in this lobby.
  queuedPlayers: Player[];

  // Role requirements to be filled to start the match
  requirements: FormatRequirement[];

  // Options for match
  matchOptions: {
    game: string;
    region: string;
    callbackUrl: string;
    players: Player[];
    preferences?: {
      requiredPlayers?: number;
    };
  };
}
