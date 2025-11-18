import mongoose, { Schema, Document } from 'mongoose';

export interface IRewardWalletBalance extends Document {
  userId: mongoose.Types.ObjectId;
  totalPaid: number;
  totalUnpaid: number;
  updatedAt: Date;
}

const RewardWalletBalanceSchema = new Schema<IRewardWalletBalance>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  totalUnpaid: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

export const RewardWalletBalance = mongoose.model<IRewardWalletBalance>('RewardWalletBalance', RewardWalletBalanceSchema);
