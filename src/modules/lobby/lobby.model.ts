import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Player } from '../../objects/match-player.interface';
import { FormatRequirement } from '../../objects/requirement.interface';
import { Document } from 'mongoose';
import { LobbyFormat } from '../../objects/lobby-format.interface';
import { LobbyStatus } from './lobby-status.enum';

@Schema()
export class Lobby extends Document {
  @Prop({ type: Date })
  createdAt: Date;

  @Prop()
  match: string;

  @Prop({ type: String })
  status: LobbyStatus;

  @Prop({ type: String })
  type: LobbyFormat;

  @Prop({ type: Object })
  queuedPlayers: Player[];

  @Prop({ type: Object })
  requirements: FormatRequirement[];
}

export const LobbySchema = SchemaFactory.createForClass(Lobby);
