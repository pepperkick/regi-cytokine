import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';
import { AccessListsCommand } from '../access-lists.command';

@Discord()
@SlashGroup('access-lists', 'lobby')
export class DeleteAccessListCommand {
  @Slash('delete', {
    description: 'Delete an access list',
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

    delete lobbyLists[name];

    await LobbyCommand.preferenceService.storeData(
      id,
      PreferenceKeys.lobbyAccessLists,
      lobbyLists,
    );

    return await interaction.reply({
      content: `Access list '${name}' has been deleted.`,
      ephemeral: true,
    });
  }
}
