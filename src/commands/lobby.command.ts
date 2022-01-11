import {
  ButtonInteraction,
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} from 'discord.js';
import {
  Discord,
  SlashGroup,
  Slash,
  SlashOption,
  SlashChoice,
  ButtonComponent,
} from 'discordx';
import { Logger } from '@nestjs/common';
import { LobbyService } from '../modules/lobby/lobby.service';
import { LobbyOptions } from '../modules/lobby/lobby-options.interface';
import * as config from '../../config.json';
import { LobbyFormat } from '../objects/lobby-format.interface';
import { Player } from '../objects/match-player.interface';
import { Game } from 'src/objects/game.enum';
import { MessagingService } from 'src/messaging.service';
import { ButtonType } from '../objects/buttons/button-types.enum';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  private readonly logger = new Logger(LobbyCommand.name);
  static service: LobbyService;
  static messaging: MessagingService;

  constructor(
    private readonly service: LobbyService,
    private readonly messaging: MessagingService,
  ) {
    LobbyCommand.service = service;
    LobbyCommand.messaging = messaging;
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

      // If the format is invalid, reply with an error message.
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
        format: formatConfig,
        matchOptions: {
          region: region,
          game: <Game>formatConfig.game,
          requiredPlayers: formatConfig.maxPlayers,
          players: [],
        },
      };
      console.log(options);

      // Reply to the interaction with a message stating that the lobby is being created.
      await interaction.reply(
        '🕒 Creating a new lobby with your parameters...',
      );

      // Send the request to the lobby service (redirects it to Cytokine's API)
      let lobby = await LobbyCommand.service.createLobby(options);

      // If lobby creation was unsuccessful, return an error message.
      if (!lobby) {
        return await interaction.editReply(`❌ Failed to create lobby.`);
      }

      // Add the initiator to the queue.
      lobby = await LobbyCommand.service.addPlayer(player, lobby._id);

      console.log(lobby);

      // Create the new message to edit the interaction with the lobby's status.
      await LobbyCommand.messaging.lobbyReply(
        interaction,
        formatConfig,
        lobby,
        {
          content: ':white_check_mark: Successfully created lobby.',
          region,
          userId: interaction.user.id,
        },
      );
    }
  }

  /**
   * Gets the Lobby object from the command reply.
   */
  async getLobbyFromInteraction(interaction: ButtonInteraction, lobbyId) {
    // Find the lobby with this ID.
    const lobby = await LobbyCommand.service.getLobby(lobbyId);

    console.log(lobby);

    // If the lobby wasn't found, change the message into an error one.
    if (!lobby) {
      interaction.update({
        content: '❌ Lobby not found: must have expired or been deleted.',
      });
      return;
    }

    return lobby;
  }

  /**
   * Queue button handler
   */
  @ButtonComponent(ButtonType.QUEUE)
  async handleQueue(interaction: ButtonInteraction) {
    // Hacky way to get the Lobby ID from the embed.
    const lobbyId = interaction.message.embeds[0].title.replace('Lobby ', '');

    // Get the Lobby object, player object and lobbyId
    let lobby = await this.getLobbyFromInteraction(interaction, lobbyId);

    // Declare player object to add/remove from the queue.
    const player = {
      name: interaction.user.username,
      discord: interaction.user.id,
      roles: ['player'],
    };

    // Check if the player is already in the queue to deny their entry.
    if (lobby.queuedPlayers.find((p) => p.discord == player.discord))
      return interaction.reply({
        content: `<@${player.discord}> You cannot queue into this lobby: You're already queued.`,
        ephemeral: true,
      });

    // TODO: Verify the SteamID of the player trying to join (check if their Discord<->Steam are linked)

    // Add the player to the queue.
    lobby = await LobbyCommand.service.addPlayer(player, lobbyId);

    // Do the lobbyReply again, but this time with the updated lobby.
    LobbyCommand.messaging.updateReply(lobby, <Message>interaction.message);
  }

  /**
   * Unqueue button handler
   */
  @ButtonComponent(ButtonType.UNQUEUE)
  async handleUnqueue(interaction: ButtonInteraction) {
    // TODO: Needs implementation in the backend first.
    // // Hacky way to get the Lobby ID from the embed.
    // const lobbyId = interaction.message.embeds[0].title.replace('Lobby ', '');
    // // Get the Lobby object, player object and lobbyId
    // let lobby = await this.getLobbyFromInteraction(interaction, lobbyId);
    // // Declare player object to add/remove from the queue.
    // const player = {
    //   name: interaction.user.username,
    //   discord: interaction.user.id,
    //   roles: ['player'],
    // };
    // // Check if the player is already in the queue to remove them, if not, deny their request to unqueue
    // // lmao, unqueueing when you're not queued 1000iq
    // if (!lobby.queuedPlayers.find((p) => p.discord == player.discord))
    //   return interaction.reply({
    //     content: `<@${player.discord}> You are not in this lobby's queue.`,
    //     ephemeral: true,
    //   });
  }
}
