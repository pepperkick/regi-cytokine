import { CommandInteraction, Message, MessageEmbed } from 'discord.js';
import { Discord, SlashGroup, Slash, SlashOption, SlashChoice } from 'discordx';
import { Logger } from '@nestjs/common';
import { LobbyService } from '../modules/lobby/lobby.service';
import { LobbyOptions } from '../modules/lobby/lobby-options.interface';
import * as config from '../../config.json';
import { LobbyFormat } from '../objects/lobby-format.interface';
import { Player } from '../objects/match-player.interface';
import { Game } from 'src/objects/game.enum';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  private readonly logger = new Logger(LobbyCommand.name);
  static service: LobbyService;

  constructor(private readonly service: LobbyService) {
    LobbyCommand.service = service;
  }

  // Slash command
  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    // TODO: Properly support regions
    @SlashChoice({ Sydney: 'sydney' })
    @SlashOption('region', {
      description: 'The region the lobby will be in.',
      required: true,
    })
    region: string,
    // Supported parsed formats as an option
    @SlashChoice(LobbyService.formats.names)
    @SlashOption('format', {
      description: 'The format of the lobby.',
      required: true,
    })
    format: string,
    interaction: CommandInteraction,
  ) {
    // Check for the interaction being of type CommandInteraction
    // This way we can reply to the user once the command has been executed, and get corresponding Discord data.
    if (interaction instanceof CommandInteraction) {
      // Check validity of format sent by user.
      const formatConfig = config.formats.filter(
        (item) => item.name === format,
      )[0] as LobbyFormat;

      if (!formatConfig) {
        return await interaction.reply({
          content: 'Unknown format',
          ephemeral: true,
        });
      }

      // Get player from the Discord initiator
      const player: Player = {
        name: interaction.user.username,
        discord: interaction.user.id,
        roles: ['creator'],
      };

      // Declare the LobbyOptions object to send over the request.
      const options: LobbyOptions = {
        distribution: formatConfig.distribution,
        callbackUrl: config.localhost,
        queuedPlayers: [player],
        requirements: formatConfig.requirements,
        region,
        game: <Game>formatConfig.game,
        matchOptions: {
          players: [],
        },
      };
      console.log(options);

      // Send the request to the lobby service (redirects it to Cytokine's API)
      const lobby = await LobbyCommand.service.createLobby(options);

      // If lobby creation was unsuccessful, return an error message.
      if (!lobby) {
        return await interaction.reply(`Failed to create lobby`);
      }

      console.log(lobby);

      // Create a Discord message from JSON with embed info.
      const embed = new MessageEmbed({
        title: `Lobby ${lobby._id}`,
        description: '',
        color: 0x3a9d3c,
        fields: [
          {
            name: '🗒 Format',
            value: `${formatConfig.name}\n\n**Max. Players:** ${formatConfig.maxPlayers}\n\n**Distribution:** ${formatConfig.distribution}\n\n`,
            inline: true,
          },
          {
            name: '📍 Region',
            value: `**${region}**`,
            inline: true,
          },
          {
            name: '🎮 Game',
            value: `${lobby.game}`,
            inline: true,
          },
          {
            name: '👥 Queued Players',
            value: `${lobby.queuedPlayers.length}/${formatConfig.maxPlayers}\n\n<@${interaction.user.id}>`,
            inline: false,
          },
          {
            name: '\u200B',
            value: 'Click on the button below to queue up!',
          },
        ],
      });
      const message = await interaction.reply(embed);

      // Temporary reply until Lobby creation logic is finished.
      return await interaction.reply(
        `${format} at ${region} is what the user wants! ${lobby._id}`,
      );
    }
  }
}
