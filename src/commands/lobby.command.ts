import { CommandInteraction } from 'discord.js';
import { Discord, SlashGroup, Slash, SlashOption } from 'discordx';
//import { LobbyService } from '../lobby.service';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  //static lobbyserv: LobbyService;
  test = 0;
  constructor() {
    this.test = 1;
  }
  //constructor(private readonly lobbyService: LobbyService) { LobbyCommand.lobbyserv = lobbyService; }

  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    @SlashOption('region', { description: 'The region the lobby will be in.' })
    region: string,
    interaction: CommandInteraction,
  ) {
    if (interaction instanceof CommandInteraction)
      return await interaction.reply(`${region} is what the user wants!`);
  }
}
