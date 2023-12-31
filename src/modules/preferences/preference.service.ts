import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Logger } from '@nestjs/common';
import { Preference } from './preference.model';

export class PreferenceService {
  private readonly logger = new Logger(PreferenceService.name);

  constructor(
    @InjectModel(Preference.name)
    private readonly preference: Model<Preference>,
  ) {}

  getById(id: string) {
    return this.preference.findById(id);
  }

  async storeData(
    id: string,
    key: string,
    value:
      | string
      | string[]
      | number
      | number[]
      | boolean
      | boolean[]
      | {
          [key: string]: any;
        },
  ) {
    let preference = await this.getById(id);

    if (!preference) {
      preference = new this.preference({
        _id: id,
      });
      preference.data = {};
    }

    preference.data[key] = value;
    preference.markModified('data');
    await preference.save();

    this.logger.debug(preference);
  }

  async getData(
    id: string,
    key: string,
  ): Promise<
    | string
    | string[]
    | number
    | number[]
    | boolean
    | boolean[]
    | {
        [key: string]: any;
      }
  > {
    const preference = await this.getById(id);
    return preference ? preference.data[key] : null;
  }

  async getDataString(id: string, key: string): Promise<string> {
    const preference = await this.getById(id);
    return preference ? preference.data[key] : null;
  }

  async getDataStringArray(id: string, key: string): Promise<string[]> {
    const preference = await this.getById(id);
    return preference ? preference.data[key] || [] : [];
  }
}
