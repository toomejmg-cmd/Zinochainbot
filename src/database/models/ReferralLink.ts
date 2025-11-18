import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralLink extends Document {
  referralAccountId: mongoose.Types.ObjectId;
  inviteCode: string;
  isActive: boolean;
  createdAt: Date;
}

const ReferralLinkSchema = new Schema<IReferralLink>({
  referralAccountId: {
    type: Schema.Types.ObjectId,
    ref: 'ReferralAccount',
    required: true,
    index: true
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const ReferralLink = mongoose.model<IReferralLink>('ReferralLink', ReferralLinkSchema);
