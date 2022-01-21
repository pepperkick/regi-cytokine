import { Body, Controller, Logger, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @Post('/lobbies/callback')
  async notify(@Query('status') status: string, @Body() lobby: any) {
    this.logger.log(
      `Received POST request with status '${status}' for lobby ${lobby._id}`,
    );

    // The lobby object is not always the lobby.
    // To know if we're dealing with a Lobby or Match document, we must check for the "match" prop in it.
    // If it exists, it's a lobby. If not, it's a match.
    if (lobby.match !== undefined) {
      // We have Lobby information
      // Currently for DISTRIBUTING and DISTRIBUTED
      switch (status) {
        case 'DISTRIBUTING': {
          await this.appService.lobbyNotifyDistributing(lobby._id);
          break;
        }
        case 'DISTRIBUTED': {
          await this.appService.lobbyNotifyDistributed(lobby);
          break;
        }
      }
    } else {
      // We have a match object. We need the lobby ID to work with.
      // Currently for LOBBY_READY and LIVE
      const { _id: lobbyId } = await this.appService.getLobbyFromMatchId(
        lobby._id,
      );

      switch (status) {
        case 'LOBBY_READY': {
          await this.appService.lobbyNotifyLobbyReady(lobbyId);
          break;
        }
        case 'CREATING_SERVER': {
          await this.appService.lobbyNotifyCreatingServer(lobbyId);
          break;
        }
        case 'LIVE': {
          await this.appService.lobbyNotifyLive(lobbyId);
          break;
        }
        case 'FAILED': {
          await this.appService.lobbyNotifyFailed(lobbyId);
          break;
        }
      }

      return 'ok';
    }
  }
}
