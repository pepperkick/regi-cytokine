import { LobbyFormat } from '../../objects/lobby-format.interface';

export interface LobbyOptions {
  // The region this lobby will be hosted in.
  region: string;

  // The format the lobby will be played in.
  format: LobbyFormat;
}
