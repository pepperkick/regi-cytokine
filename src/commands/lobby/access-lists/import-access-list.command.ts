import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { CommandInteraction } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';

@Discord()
@SlashGroup('access-lists', 'lobby')
export class ImportAccessListCommand {
  @Slash('import', {
    description: 'Import an access list',
  })
  async exec(
    @SlashOption('contents', {
      description: `Contents of the access list to import`,
      type: 'STRING',
    })
    contents: string,
    interaction: CommandInteraction,
  ) {
    const id = AccessConfigsCommand.getPrefId(interaction);

    let lobbyLists = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessLists,
    );

    if (!lobbyLists) {
      lobbyLists = {};
    }

    try {
      const list = JSON.parse(contents);
      const name = list.name;

      if (lobbyLists[name]) {
        return await interaction.reply({
          content: `Access list with the name '${name}' already exists.`,
          ephemeral: true,
        });
      }

      if (!list.users && !list.roles) {
        return await interaction.reply({
          content: `No users or roles were found in the access list.`,
          ephemeral: true,
        });
      }

      lobbyLists[name] = list;

      await LobbyCommand.preferenceService.storeData(
        id,
        PreferenceKeys.lobbyAccessLists,
        lobbyLists,
      );

      return await interaction.reply({
        content: `Your access list with name '${name}' has been imported successfully`,
        ephemeral: true,
      });
    } catch (error) {
      return await interaction.reply({
        content: 'Invalid JSON',
        ephemeral: true,
      });
    }
  }
}
