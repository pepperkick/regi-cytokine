import { Body, Controller, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/lobbies/callback')
  async notify(@Query('status') status: string, @Body() lobby: any) {
    console.log(`Lobby: ${lobby}`);
    console.log(`Value of lobby.match: ${lobby.match}`);
    console.log(`Status: ${status}`);
    // The lobby object is not always the lobby.
    // To know if we're dealing with a Lobby or Match document, we must check for the "match" prop in it.
    // If it exists, it's a lobby. If not, it's a match.
    if (lobby.match !== undefined) {
      // We have Lobby information
      // Currently for DISTRIBUTING and DISTRIBUTED
      switch (status) {
        case 'DISTRIBUTING': {
          this.appService.lobbyNotifyDistributing(lobby._id);
          break;
        }
        case 'DISTRIBUTED': {
          this.appService.lobbyNotifyDistributed(lobby._id);
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
          this.appService.lobbyNotifyLobbyReady(lobbyId);
          break;
        }
        case 'LIVE': {
          this.appService.lobbyNotifyLive(lobbyId);
          break;
        }
      }

    return 'ok';
    }
  }
}
