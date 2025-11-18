import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminSettings extends Document {
  namespace: string;
  settings: any;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSettingsSchema = new Schema<IAdminSettings>({
  namespace: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  settings: {
    type: Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

export const AdminSettings = mongoose.model<IAdminSettings>('AdminSettings', AdminSettingsSchema);
