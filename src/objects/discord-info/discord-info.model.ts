import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class DiscordInfo extends Document {
  // The lobby to which store Discord information of.
  @Prop({ type: String })
  lobbyId: string;

  // The Discord user ID of the user who created the lobby.
  @Prop({ type: String })
  creatorId: string;

  // The Message ID attached to this lobby instance (CommandInteraction reply)
  // This is to obtain the message statessly.
  @Prop({ type: String })
  messageId: string;

  // Discord Text Channel created by this lobby instance.
  @Prop({ type: String })
  channelId: string;

  // Discord Voice Channel created by this lobby instance.
  @Prop({ type: String })
  voiceChannelId: string;
}

export const DiscordInfoSchema = SchemaFactory.createForClass(DiscordInfo);
