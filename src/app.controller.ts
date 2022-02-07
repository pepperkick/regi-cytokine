import { Body, Controller, Logger, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @Post('/lobbies/callback')
  async notify(@Query('status') status: string, @Body() data: any) {
    this.logger.log(
      `Received POST request with status '${status}' for lobby ${data._id}`,
    );

    // The lobby object is not always the lobby.
    // To know if we're dealing with a Lobby or Match document, we must check for the "match" prop in it.
    // If it exists, it's a lobby. If not, it's a match.
    if (data.match !== undefined) {
      // We have Lobby information
      // Currently for DISTRIBUTING and DISTRIBUTED
      switch (status) {
        case 'DISTRIBUTING': {
          await this.appService.lobbyNotifyDistributing(data._id);
          break;
        }
        case 'DISTRIBUTED': {
          await this.appService.lobbyNotifyDistributed(data);
          break;
        }
        case 'CLOSED': {
          await this.appService.lobbyNotifyClosed(data._id);
          break;
        }
      }
    } else {
      // We have a match object. We need the lobby ID to work with.
      // Currently for LOBBY_READY and LIVE
      const { _id: lobbyId } = await this.appService.getLobbyFromMatchId(
        data._id,
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
        case 'WAITING_FOR_PLAYERS': {
          // Lighthouse should send Cytokine the server information in data, to then be redirected here.
          await this.appService.lobbyNotifyWaitingForPlayers(lobbyId, data);
          break;
        }
        case 'LIVE': {
          await this.appService.lobbyNotifyLive(lobbyId);
          break;
        }
        case 'FINISHED': {
          await this.appService.lobbyNotifyFinished(lobbyId);
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
