import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralAccount extends Document {
  userId: mongoose.Types.ObjectId;
  referralCode: string;
  rewardsWalletId?: mongoose.Types.ObjectId;
  lastLinkUpdateAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralAccountSchema = new Schema<IReferralAccount>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  rewardsWalletId: {
    type: Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null
  },
  lastLinkUpdateAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export const ReferralAccount = mongoose.model<IReferralAccount>('ReferralAccount', ReferralAccountSchema);
