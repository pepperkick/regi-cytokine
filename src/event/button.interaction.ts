import { Logger } from '@nestjs/common';
import { ButtonInteraction } from 'discord.js';

// Handles button interactions throughout the bot's slash commands.
export class ButtonInteractionHandler {
  private readonly logger = new Logger(ButtonInteractionHandler.name);

  constructor(private readonly interaction: ButtonInteraction) {

  }
}
