import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminSettingAudit extends Document {
  adminId?: mongoose.Types.ObjectId;
  namespace: string;
  oldValue?: any;
  newValue?: any;
  updatedAt: Date;
}

const AdminSettingAuditSchema = new Schema<IAdminSettingAudit>({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  },
  namespace: {
    type: String,
    required: true,
    index: true
  },
  oldValue: { type: Schema.Types.Mixed, default: null },
  newValue: { type: Schema.Types.Mixed, default: null },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: -1
  }
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

export const AdminSettingAudit = mongoose.model<IAdminSettingAudit>('AdminSettingAudit', AdminSettingAuditSchema);
