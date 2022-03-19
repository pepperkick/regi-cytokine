import { Discord, SlashGroup } from 'discordx';
import { Module } from '@nestjs/common';
import { CreateAccessConfigCommand } from './access-configs/create-access-config.command';
import { DeleteAccessConfigCommand } from './access-configs/delete-access-config.command';
import { SetAccessListOnConfigCommand } from './access-configs/set-access-list.command';
import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import * as config from '../../../config.json';
import { LobbyCommand, PreferenceKeys } from '../lobby.command';
import { ViewAccessConfigsCommand } from './access-configs/view-access-config.command';
import { ExportAccessConfigCommand } from './access-configs/export-access-config.command';
import { ImportAccessConfigCommand } from './access-configs/import-access-config.command';

@Discord()
@SlashGroup({
  name: 'access-configs',
  root: 'lobby',
  description: 'Manage your lobby access configs.',
})
@Module({
  exports: [
    CreateAccessConfigCommand,
    DeleteAccessConfigCommand,
    ViewAccessConfigsCommand,
    ExportAccessConfigCommand,
    ImportAccessConfigCommand,
    SetAccessListOnConfigCommand,
  ],
})
export class AccessConfigsCommand {
  static getPrefId(
    interaction: CommandInteraction | AutocompleteInteraction,
  ): string {
    let id = interaction.user.id;
    if (interaction.channel.id === config.discord.channels.admin) {
      id = 'guild';
    }
    return id;
  }

  static async getNameChoices(interaction: AutocompleteInteraction) {
    const id = AccessConfigsCommand.getPrefId(interaction);

    const names = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
    );

    const choices = [];
    if (names) {
      for (const name of Object.keys(names)) {
        choices.push({
          name: name,
          value: name,
        });
      }
    }

    return await interaction.respond(
      choices
        .filter((choice) =>
          choice.name.includes(
            <string>interaction.options.getFocused(true).value,
          ),
        )
        .slice(0, 24),
    );
  }
}
