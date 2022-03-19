import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';
import { AccessListsCommand } from '../access-lists.command';
import * as config from '../../../../config.json';

@Discord()
@SlashGroup('access-lists', 'lobby')
export class ViewAccessListCommand {
  @Slash('view', {
    description: 'View an access list',
  })
  async exec(
    @SlashOption('name', {
      description: `Type the list name`,
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    name: string,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    if (interaction instanceof AutocompleteInteraction) {
      switch (interaction.options.getFocused(true).name) {
        case 'name': {
          return AccessListsCommand.getNameChoices(interaction);
        }
      }

      return interaction.respond([]);
    }

    const id = AccessConfigsCommand.getPrefId(interaction);

    const lobbyLists = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessLists,
    );

    if (!lobbyLists[name]) {
      return await interaction.reply({
        content: `Access list with the name '${name}' does not exist.`,
        ephemeral: true,
      });
    }

    const list = lobbyLists[name];
    let userList = '';
    let roleList = '';

    if (list.users) {
      for (const id of list.users) {
        const member = await (
          await LobbyCommand.discordService
            .getClient()
            .guilds.fetch(config.discord.guild)
        ).members.fetch(id);

        if (member) {
          userList += `**${member.user.username}#${member.user.discriminator}** (${member.id})\n`;
        } else {
          userList += `**${id}** (User is not in the server)\n`;
        }
      }
    }

    if (list.roles) {
      for (const id of list.roles) {
        const role = await (
          await LobbyCommand.discordService
            .getClient()
            .guilds.fetch(config.discord.guild)
        ).roles.fetch(id);

        if (role) {
          roleList += `**${role.name}** (${role.id})\n`;
        } else {
          roleList += `**${id}** (Role no longer exists)\n`;
        }
      }
    }

    const fields = [];

    if (userList != '') {
      fields.push({
        name: 'Users',
        value: userList,
      });
    }

    if (roleList != '') {
      fields.push({
        name: 'Roles',
        value: roleList,
      });
    }
    return await interaction.reply({
      embeds: [
        {
          title: `Access list '${list.name}'`,
          fields: fields,
          color: 'BLUE',
        },
      ],
      ephemeral: true,
    });
  }
}
