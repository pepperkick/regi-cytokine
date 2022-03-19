import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Preference, PreferenceSchema } from './preference.model';
import * as config from '../../../config.json';
import { PreferenceService } from './preference.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Preference.name, schema: PreferenceSchema },
    ]),
    MongooseModule.forRoot(config.mongodbUri),
  ],
  providers: [PreferenceService],
  exports: [PreferenceService],
})
export class PreferenceModule {}
