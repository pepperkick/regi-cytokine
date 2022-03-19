import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { AutocompleteInteraction, CommandInteraction, Role } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';
import { AccessListsCommand } from '../access-lists.command';

@Discord()
@SlashGroup('access-lists', 'lobby')
export class RemoveRoleFromAccessListCommand {
  @Slash('remove-role', {
    description: 'Remove a role from access list',
  })
  async exec(
    @SlashOption('name', {
      description: `Type the list name`,
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    name: string,
    @SlashOption('role', {
      description: `Type the role name`,
    })
    role: Role,
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
        content: `Access list with that the '${name}' does not exist.`,
        ephemeral: true,
      });
    }

    const list = lobbyLists[name];
    if (!list.roles) {
      return await interaction.reply({
        content: `Role not found in access list`,
        ephemeral: true,
      });
    }

    list.roles = list.roles.filter((r) => r !== role.id);
    lobbyLists[name] = list;

    await LobbyCommand.preferenceService.storeData(
      id,
      PreferenceKeys.lobbyAccessLists,
      lobbyLists,
    );

    return await interaction.reply({
      content: `Role '${role.name}' has been removed from '${name}' access list.`,
      ephemeral: true,
    });
  }
}
