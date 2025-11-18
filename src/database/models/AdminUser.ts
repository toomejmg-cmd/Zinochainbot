import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminUser extends Document {
  telegramId: number;
  role: string;
  createdAt: Date;
}

const AdminUserSchema = new Schema<IAdminUser>({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  role: {
    type: String,
    default: 'admin',
    enum: ['admin', 'super_admin']
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const AdminUser = mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
