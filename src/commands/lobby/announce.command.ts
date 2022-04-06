import { Logger } from '@nestjs/common';
import { CommandInteraction, NewsChannel, TextChannel } from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { LobbyCommand } from '../lobby.command';
import * as config from '../../../config.json';

@Discord()
@SlashGroup('lobby')
export class AnnounceSubCommand {
  private readonly logger: Logger = new Logger(AnnounceSubCommand.name);

  @Slash('announce', { description: 'Announce a lobby.' })
  async announce(
    @SlashOption('title', {
      description:
        '[OPTIONAL] A title to be displayed on the announcement. (24 characters max only ASCII)',
      required: false,
    })
    title: string,
    interaction: CommandInteraction,
  ) {
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // See if this user has an active Lobby running.
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();
    const lobby = lobbies.filter((l) => l.createdBy === interaction.user.id)[0];

    if (!lobby)
      return await interaction.editReply(
        `:x: You have no active Lobbies running to announce.`,
      );

    if (lobby.status != 'WAITING_FOR_REQUIRED_PLAYERS')
      return await interaction.editReply(
        `:x: You can only announce Lobbies that haven't started yet.`,
      );

    if (title?.length > 24)
      return await interaction.editReply(`:x: Your title is too long!`);

    // Get more info (region, access list?, format, etc)
    const iLobby = await LobbyCommand.service.getInternalLobbyById(lobby._id);

    if (iLobby?.announcements >= config.lobbies.maxAnnounces)
      return await interaction.editReply(
        `:x: You have reached the maximum amount of announces per-lobby (**${iLobby.announcements}**/**${config.lobbies.maxAnnounces}**)`,
      );

    const { region, accessConfig, format, channels } = iLobby;

    // Channel the announcement will be sent to.
    let channel: TextChannel | NewsChannel =
        (await LobbyCommand.discordService.getChannel(
          channels.general.textChannelId,
        )) as TextChannel | NewsChannel,
      role = null;

    // If an access config is present, we only need to tag @here inside the lobby's general channel.
    // Permissions will be set accordingly, so for region-format types of lobbies others won't see the channel and not get tagged.
    const access = await LobbyCommand.service.getAccessConfig(
      accessConfig,
      interaction.user.id,
    );
    const ann = config?.regions[region]?.announce;

    // Blacklisted lobbies should still be broadcasted generally, as only some players are banned from the Lobby while others aren't.
    // However, if a whitelist is present on the Lobby, only players on the whitelist will be able to see the announcement.
    // Would be pointless to post such an announcement public.
    //
    // Condition states: If access config is a blacklist or if there isn't an access config present, look for the announcement channel.
    if (
      access?.accessLists['player']?.blacklist ||
      accessConfig?.length < 1 ||
      !accessConfig ||
      !access
    ) {
      if (ann.length > 0)
        channel = (await LobbyCommand.discordService.getChannel(ann)) as
          | TextChannel
          | NewsChannel;
      role = await LobbyCommand.discordService.findRegionFormatRole(
        region,
        format,
      );
    }

    // Clean the title off any weird Unicode character.
    title = title?.replace(/[^\x00-\x7F]+/g, '');

    // Prepare the announce embed.
    const { url: messageUrl } = await LobbyCommand.discordService.getMessage(
      iLobby.messageId,
      channels.general.textChannelId,
    );

    const embed = await LobbyCommand.discordService.buildBaseEmbed(
      title?.length > 0 ? title : 'A new Lobby is starting!',
      `A new Lobby created by <@${interaction.user.id}> is starting! [Click here to go to the Lobby](${messageUrl}).`,
    );

    // Add information fields.
    embed
      .addField(
        'Region',
        `\`${LobbyCommand.service.getRegion(region).name}\``,
        true,
      )
      .addField('Format', `**${format}**`, true)
      .addField('Distribution', `**${lobby.distribution}**`, true)
      .addField(
        'Current Queue',
        `**${lobby.queuedPlayers.length}** players queued out of **${lobby.maxPlayers}**`,
        true,
      )
      .addField(
        'Channels',
        `<#${channels.general.textChannelId}>\n<#${channels.general.voiceChannelId}>`,
        true,
      );

    // Send the announcement
    iLobby.announcements += 1;
    iLobby.markModified('announcements');

    await iLobby.save();

    await interaction.editReply(
      `:white_check_mark: Successfully announced your Lobby to <#${channel.id}>!`,
    );

    const announce = await channel.send({
      content: role === null ? '@here' : `${role}`,
      embeds: [embed],
    });

    // Publish the announcement if it's on a news channel (Announcement Channel)
    if (channel instanceof NewsChannel) await announce.crosspost();
    return announce;
  }
}
